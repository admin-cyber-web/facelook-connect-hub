---
name: Marketplace UPI verification
description: Marketplace UPI orders require manual bank-statement matching before shipment.
---

For this marketplace, submitting a UTR does not confirm payment. Keep the order in verification pending until an admin matches the transaction against the bank statement; shipment statuses are available only after that approval.

**Why:** The user explicitly requires real payment verification and rejects instant client-side confirmation based only on submitted transaction details.

**How to apply:** Enforce the pending-to-confirmed transition in both the Supabase database and the admin/customer UI. Do not allow customer actions or direct status changes to advance an unverified UPI order.
