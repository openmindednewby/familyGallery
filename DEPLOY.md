# family-gallery Deploy Guide

How to build, push, and deploy family-gallery to both staging and production.

---

## Architecture

```
  Windows PC                 Staging Laptop               Hetzner Production
  (this repo)            (registry host + K3s)            (K3s cluster)
                                                          
  docker build  ──push──>  registry :5000  <──pull──  containerd (K3s)
                              │
                              │  K3s on laptop pulls ──> localhost:5000
                              v
                           localhost:5000/family-gallery:latest
```

**Single source of truth**: the Docker registry on the staging laptop.

- **Staging pods** pull from `localhost:5000/family-gallery:latest`
- **Production pods** pull from `10.0.0.2:5000/family-gallery:latest` (same registry via WireGuard)

Both endpoints resolve to the same image — push once, both environments can pull.

---

## Prerequisites (One-Time Setup)

### 1. Docker insecure registry configuration

The registry uses plain HTTP (no TLS). Add this to `~/.docker/daemon.json` on your Windows PC:

```json
{
  "insecure-registries": [
    "192.168.10.200:5000",
    "10.0.0.2:5000"
  ]
}
```

Then restart Docker Desktop. Which address to use:
- `192.168.10.200:5000` — when on the same LAN as the staging laptop (fastest)
- `10.0.0.2:5000` — when remote, via WireGuard

### 2. Registry credentials

```bash
docker login 10.0.0.2:5000 -u jim -p jim
# or
docker login 192.168.10.200:5000 -u jim -p jim
```

### 3. Network access

- **WireGuard** connected (if not on staging LAN) — verify with `ping 10.0.0.2`
- **SSH access** to production: `ssh root@204.168.225.236`
- **SSH access** to staging: `ssh jim@10.0.0.2`

---

## The Deploy Flow (3 Steps)

### Step 1 — Code Changes

```bash
cd family-gallery
# Make your changes (bump deps, fix bugs, etc.)
npm install --legacy-peer-deps   # if you changed package.json
npm audit                         # verify no new vulns
cd ..
git add -A && git commit -m "Your change"
git push
```

### Step 2 — Build and Push Image

From the **repo root** (`familyGallery/`):

```bash
cd family-gallery
docker build \
  -t 10.0.0.2:5000/family-gallery:latest \
  -f nginx.prod.dockerfile \
  .

docker push 10.0.0.2:5000/family-gallery:latest
```

The image is now available at **both** `localhost:5000` (staging's view) and `10.0.0.2:5000` (prod's view).

### Step 3 — Restart Deployments

Trigger both environments to pull the fresh image:

```bash
# Staging
ssh jim@10.0.0.2 "sudo kubectl rollout restart deployment/family-gallery -n dloizides && \
                   sudo kubectl rollout status deployment/family-gallery -n dloizides --timeout=90s"

# Production
ssh root@204.168.225.236 "kubectl rollout restart deployment/family-gallery -n dloizides && \
                           kubectl rollout status deployment/family-gallery -n dloizides --timeout=90s"
```

> **Note**: Production may have `imagePullPolicy: IfNotPresent` set (leftover from a manual import). If the new image doesn't get pulled, patch it back to `Always`:
> ```bash
> ssh root@204.168.225.236 "kubectl patch deployment/family-gallery -n dloizides -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"family-gallery\",\"imagePullPolicy\":\"Always\"}]}}}}'"
> ```

---

## Verification

Confirm both pods are running the same image:

```bash
echo "=== PROD ==="
ssh root@204.168.225.236 "kubectl get pods -n dloizides -l app=family-gallery -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'"
echo ""
echo "=== STAGING ==="
ssh jim@10.0.0.2 "sudo kubectl get pods -n dloizides -l app=family-gallery -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'"
echo ""
```

Both should show a recent digest (not Apr 10 or older).

Test the live sites:
- **Staging**: Get URL via `ssh jim@10.0.0.2 "sudo kubectl get ingress -n dloizides | grep family"`
- **Production**: Check the Ingress host for `family-gallery` on prod

---

## Troubleshooting

### "http: server gave HTTP response to HTTPS client"

You haven't added the registry to Docker's `insecure-registries` list. See prerequisites.

### "Error response from daemon: unauthorized"

You forgot `docker login`. Credentials are `jim` / `jim`.

### Push hangs or times out on `10.0.0.2:5000`

WireGuard is disconnected. Verify: `ping 10.0.0.2`. If unreachable, reconnect WireGuard or switch to the LAN IP `192.168.10.200:5000` (if on the same network).

### New image not pulled after rollout

Check image pull policy:
```bash
ssh root@204.168.225.236 "kubectl get deployment family-gallery -n dloizides -o jsonpath='{.spec.template.spec.containers[0].imagePullPolicy}'"
```
If it says `Never` or `IfNotPresent`, patch it back to `Always` (see note in Step 3).

### Fallback: Direct containerd import (no registry)

If the registry is unreachable but you need to deploy NOW, you can SCP a tar into the cluster:

```bash
# Local
docker save 10.0.0.2:5000/family-gallery:latest -o /tmp/fg.tar
scp /tmp/fg.tar root@204.168.225.236:/tmp/

# On production server
ssh root@204.168.225.236 "k3s ctr images import /tmp/fg.tar && \
                           kubectl patch deployment/family-gallery -n dloizides -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"family-gallery\",\"imagePullPolicy\":\"IfNotPresent\"}]}}}}' && \
                           kubectl rollout restart deployment/family-gallery -n dloizides && \
                           rm /tmp/fg.tar"
```

**Caveat**: This only updates one cluster. The registry will still serve the OLD image — any new pulls (including on the other environment) will get the old version. Only use as a fallback.

---

## Security Fix Workflow (Dependabot/CVE)

When a GitHub security alert fires for a transitive dependency:

1. **Open repo**, check `npm audit` output for the CVE
2. **Add `overrides`** in `package.json` to pin the vulnerable transitive dep to a safe version:
   ```json
   "overrides": {
     "lodash": "^4.18.1"
   }
   ```
3. **Regenerate lock file**: `npm install --legacy-peer-deps`
4. **Verify fix**: `npm audit | grep <package>` — should show fewer advisories
5. **Dockerfile**: Make sure it uses `npm ci` (not `npm install`) with the lock file, so the override is respected in production builds. The current `nginx.prod.dockerfile` already does this.
6. **Commit, push, build, deploy** using Steps 1–3 above.

---

## Future Automation

Consider setting up **GitHub Actions** to auto-build on push:

- Repo: `openmindednewby/familyGallery`
- Trigger: push to `main`
- Self-hosted runner on the staging laptop (already has Docker + registry access)
- Steps: `docker build` -> `docker push localhost:5000/...` -> SSH both clusters to `kubectl rollout restart`

The template at `personalServerNotes/ci-deploy-template.yml` can be adapted for this.
