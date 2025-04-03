# Decision Summary: Hosting ArcGIS JS API App on Netlify

## Evaluated Development & Deployment Options

| Option | Pros | Cons |
|--------|------|------|
| **1. ArcGIS Online Web AppBuilder / Experience Builder (hosted)** | No setup or deployment needed | Lacks advanced filtering and symbology features required for this project |
| **2. Custom ArcGIS JS API app on SCE IT-managed infrastructure** | Secure and internal | Requires coordination with IT for initial deployment and future updates |
| **3. Custom ArcGIS JS API app hosted externally (Netlify, Vercel, GitHub Pages)** | Fast to deploy and iterate; no IT bottlenecks | Requires confirmation that public hosting is acceptable |
| **4. Custom ArcGIS JS API app run locally (via Node.js or Python server)** | Simple dev setup | Not feasible—users can't install Node or Python due to lack of admin rights |
| **5. Custom app packaged as standalone `.exe` (e.g., with Electron)** | Doesn’t require web hosting | Complex packaging; harder to maintain; any change requires full rebuild and redistribution |

---

## Key Considerations

### Functionality
- ArcGIS Online-hosted builders do not support the **advanced filtering and dynamic symbology** needed.
- The ArcGIS JS API enables these features, and with AI-assisted coding tools, development is efficient and adaptable.

### Adaptability
- Internal hosting or `.exe` packaging would require IT involvement or redistribution for every change.
- Hosting on Netlify enables fast iteration and simplified deployment through Git-based workflows.

### Security
- The app does not store or expose any SCE data.
- All data access is securely handled via ArcGIS Online, which is already protected by **Okta single sign-on** and internal sharing settings.
- Public hosting is acceptable because the app only **consumes** protected data—it does not serve or store it.

---

## Final Decision: Host on Netlify

### Why Netlify?
- Free and fast static hosting for JavaScript apps
- Easy GitHub integration for CI/CD
- No need for local server installs or IT-managed infrastructure
- Secure access to ArcGIS Online services via existing authentication

This approach meets all project goals while ensuring flexibility, low maintenance, and secure integration with SCE’s existing GIS infrastructure.
