import { Kitchen } from "@/models";
import type { IOrder } from "@/models";

/**
 * Generates an HTML invoice for an order.
 * The frontend renders this in a new tab — the guest prints to PDF via browser.
 * No external PDF library needed (ponytail: use the platform).
 */
export async function generateInvoiceHtml(order: IOrder): Promise<string> {
  const kitchen = await Kitchen.findById(order.kitchen).select(
    "name address gstin settings",
  );

  const location =
    order.roomSnapshot?.roomNumber
      ? `Room ${order.roomSnapshot.roomNumber}`
      : order.tableSnapshot?.number
        ? `Table ${order.tableSnapshot.number}`
        : "Dine-in";

  const taxRows = order.items
    .map((item) => {
      const gst = item.taxPercent ?? 5;
      const base = item.lineTotal / (1 + gst / 100);
      const tax = item.lineTotal - base;
      return `
        <tr>
          <td>${item.name}</td>
          <td style="text-align:right">${item.quantity}</td>
          <td style="text-align:right">₹${item.unitPrice.toFixed(2)}</td>
          <td style="text-align:right">${gst}%</td>
          <td style="text-align:right">₹${tax.toFixed(2)}</td>
          <td style="text-align:right">₹${item.lineTotal.toFixed(2)}</td>
        </tr>`;
    })
    .join("");

  const gstin = (kitchen as any)?.gstin ?? "N/A";
  const address = (kitchen as any)?.address ?? "";


  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${order.orderNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; font-size: 13px; color: #111; padding: 32px; max-width: 720px; margin: auto; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 2px; }
    .muted { color: #6b7280; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .badge { display: inline-block; background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 600; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f4f4f5; text-align: left; padding: 8px 10px; font-size: 12px; color: #6b7280; }
    td { padding: 8px 10px; border-bottom: 1px solid #f4f4f5; }
    .totals { margin-left: auto; width: 260px; }
    .totals tr td:first-child { color: #6b7280; }
    .totals tr td:last-child { text-align: right; font-weight: 500; }
    .grand td { font-size: 16px; font-weight: 700; border-top: 2px solid #111; }
    footer { margin-top: 40px; color: #9ca3af; font-size: 11px; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${kitchen?.name ?? "Hotel Restaurant"}</h1>
      <p class="muted">${address}</p>
      <p class="muted">GSTIN: ${gstin}</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:18px;font-weight:700">TAX INVOICE</p>
      <p class="muted">Invoice #: <strong>${order.orderNumber}</strong></p>
      <p class="muted">Date: ${new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
      <p class="muted">${location}</p>
      <span class="badge">PAID</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">GST %</th>
        <th style="text-align:right">GST Amt</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${taxRows}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td>₹${order.pricing.subtotal.toFixed(2)}</td></tr>
    <tr><td>GST</td><td>₹${order.pricing.taxTotal.toFixed(2)}</td></tr>
    <tr><td>Service Charge</td><td>₹${order.pricing.serviceCharge.toFixed(2)}</td></tr>
    ${order.pricing.discount > 0 ? `<tr><td>Discount</td><td>-₹${order.pricing.discount.toFixed(2)}</td></tr>` : ""}
    <tr class="grand"><td>Total</td><td>₹${order.pricing.total.toFixed(2)}</td></tr>
  </table>

  <p class="muted" style="margin-top:16px">Payment: ${order.payment.method} · ${order.payment.status}</p>

  <footer>
    <p>Thank you for dining with us!</p>
    <p style="margin-top:4px">This is a computer-generated invoice and does not require a signature.</p>
  </footer>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}