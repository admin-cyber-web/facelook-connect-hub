---
name: Marketplace route maps
description: User-chosen route accuracy scope for marketplace shipment maps.
---

Marketplace tracking maps use a schematic route with generic intermediate hubs and the actual seller and delivery cities. Do not display a “not to scale” or similar disclaimer in the UI.

**Why:** The user wants clean tracking maps with real endpoint city names and no visible disclaimer, while the project does not use a road-routing provider.

**How to apply:** Keep the endpoint labels tied to the order’s configured source_city and destination_city, retain generic transit hubs, and avoid claims that the path is road-accurate.
