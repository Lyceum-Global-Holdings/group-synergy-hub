import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { format } from "date-fns";
import { useRef } from "react";
import tuhLogo from "@/assets/tuh-logo.png";
import { useCompany } from "@/contexts/CompanyContext";
import { PurchaseOrder } from "@/types/purchaseOrder";

interface PoDocumentProps {
  purchaseOrder: PurchaseOrder;
  onClose?: () => void;
}

export function PoDocument({ purchaseOrder, onClose }: PoDocumentProps) {
  const { selectedCompany } = useCompany();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const printInIframe = async () => {
    if (!containerRef.current) return;
    
    const clone = containerRef.current.cloneNode(true) as HTMLElement;
    
    // Extract all inline style tags from the clone
    const styleTags = Array.from(clone.querySelectorAll('style'));
    const inlineStyles = styleTags.map(s => s.textContent || '').join('\n');
    styleTags.forEach(s => s.parentNode?.removeChild(s));
    
    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;
    
    // Write full HTML document to iframe with all styles in head
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Purchase Order - ${purchaseOrder.po_number}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            
            @media print {
              .print\\:hidden {
                display: none !important;
              }
            }
            
            html, body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background: #fff;
              margin: 0;
              padding: 0;
            }
            
            ${inlineStyles}
          </style>
        </head>
        <body>
          ${clone.outerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();
    
    // Wait for all images to load
    const imgs = Array.from(iframeDoc.querySelectorAll('img'));
    await Promise.all(imgs.map(img => 
      img.complete ? Promise.resolve() : new Promise(resolve => {
        img.onload = img.onerror = () => resolve(undefined);
      })
    ));
    
    // Small delay then print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Cleanup after print
      const cleanup = () => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      };
      
      if (iframe.contentWindow) {
        iframe.contentWindow.onafterprint = cleanup;
      }
      setTimeout(cleanup, 1000);
    }, 100);
  };

  const handlePrint = () => {
    printInIframe();
  };

  const handleDownloadPDF = () => {
    printInIframe();
  };

  const po = purchaseOrder;

  return (
    <div ref={containerRef} className="po-document">
      {/* Print buttons - hidden when printing */}
      <div className="print:hidden flex gap-2 mb-4">
        <Button onClick={handlePrint} className="flex-1">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
        {onClose && (
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        )}
      </div>

      <div className="page">
        {/* Header */}
        <div className="header">
          <div>
            <div className="brand">
              <img 
                src={selectedCompany?.logo_url || tuhLogo} 
                alt={`${selectedCompany?.name || 'Company'} Logo`} 
                className="brand-logo" 
              />
            </div>
            <div className="company">
              <div><strong>THE UNIFORM HUB (PVT) LIMITED</strong></div>
              <div>Lyceum Fulfilment Centre, Kurunegala, Sri Lanka</div>
              <div>+94 76 5400 700</div>
              <div>info@tuh.lk</div>
            </div>
          </div>

          <div>
            <h2 className="doc-title">PURCHASE ORDER</h2>
            <table className="meta" aria-label="PO Meta">
              <tbody>
                <tr>
                  <td className="key">PO Number</td>
                  <td>{po.po_number}</td>
                </tr>
                <tr>
                  <td className="key">PO Date</td>
                  <td>{format(new Date(po.po_date), 'MMMM dd, yyyy')}</td>
                </tr>
                <tr>
                  <td className="key">Expected Delivery</td>
                  <td>
                    {po.expected_delivery_date 
                      ? format(new Date(po.expected_delivery_date), 'MMMM dd, yyyy')
                      : 'Not specified'
                    }
                  </td>
                </tr>
                <tr>
                  <td className="key">Currency</td>
                  <td>{po.currency}</td>
                </tr>
                {po.pr && (
                  <tr>
                    <td className="key">Source PR</td>
                    <td>{po.pr.pr_number}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Supplier and Terms */}
        <div className="info-grid">
          <div>
            <div className="bar">SUPPLIER DETAILS</div>
            <table className="info-table">
              <tbody>
                <tr>
                  <td className="key">Supplier Name</td>
                  <td className="caps bold">{po.supplier?.name || 'N/A'}</td>
                </tr>
                {po.supplier?.email && (
                  <tr>
                    <td className="key">Email</td>
                    <td>{po.supplier.email}</td>
                  </tr>
                )}
                {po.supplier?.phone && (
                  <tr>
                    <td className="key">Phone</td>
                    <td>{po.supplier.phone}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <div className="bar">TERMS & CONDITIONS</div>
            <table className="info-table">
              <tbody>
                <tr>
                  <td className="key">Payment Terms</td>
                  <td>{po.payment_terms || 'As per agreement'}</td>
                </tr>
                <tr>
                  <td className="key">Delivery Terms</td>
                  <td>{po.delivery_terms || 'As per agreement'}</td>
                </tr>
                {po.buyer_profile && (
                  <tr>
                    <td className="key">Buyer</td>
                    <td>{po.buyer_profile.full_name || po.buyer_profile.email}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Items Table */}
        <table className="items" aria-label="Items">
          <thead>
            <tr>
              <th style={{width: '5%'}}>#</th>
              <th style={{width: '12%'}}>Item Code</th>
              <th style={{width: '20%'}}>Item Name</th>
              <th>Specifications</th>
              <th style={{width: '8%'}}>Qty</th>
              <th style={{width: '8%'}}>UOM</th>
              <th style={{width: '12%'}}>Unit Price</th>
              <th style={{width: '12%'}}>Total</th>
            </tr>
          </thead>
          <tbody>
            {po.items?.map((item, index) => (
              <tr key={item.id || index}>
                <td className="center">{index + 1}</td>
                <td className="center">
                  <span className="code-badge">{item.item_code || '-'}</span>
                </td>
                <td className="bold">{item.item_name}</td>
                <td className="small">{item.specifications || item.description || '-'}</td>
                <td className="right bold">{item.quantity_ordered}</td>
                <td className="center">{item.unit_of_measure}</td>
                <td className="right">Rs. {item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="right bold">Rs. {item.total_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Financial Summary */}
        <div className="financial">
          <div className="spacer"></div>
          <table className="summary-table">
            <tbody>
              <tr>
                <td className="key">Subtotal</td>
                <td className="right">Rs. {po.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="key">Tax</td>
                <td className="right">Rs. {po.tax_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="key">Discount</td>
                <td className="right">-Rs. {po.discount_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="total-row">
                <td className="key">GRAND TOTAL</td>
                <td className="right bold">Rs. {po.final_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {po.notes && (
          <div className="notes-section">
            <div className="bar">NOTES</div>
            <div className="notes-content">
              {po.notes}
            </div>
          </div>
        )}

        {/* Approval Section */}
        <div className="approvals">
          <div className="bar">APPROVALS</div>
          <table className="approval-table" aria-label="Approvals">
            <tbody>
              <tr>
                <td style={{width: '25%'}}>
                  <div className="approval-label">Prepared By</div>
                  <div className="approval-value">{po.created_by_profile?.full_name || po.created_by_profile?.email || ''}</div>
                </td>
                <td style={{width: '25%'}}>
                  <div className="approval-label">Date</div>
                  <div className="approval-value">{format(new Date(po.created_at), 'MMM dd, yyyy')}</div>
                </td>
                <td style={{width: '25%'}}>
                  <div className="approval-label">Approved By</div>
                  <div className="approval-value">{po.approved_by_profile?.full_name || po.approved_by_profile?.email || ''}</div>
                </td>
                <td style={{width: '25%'}}>
                  <div className="approval-label">Date</div>
                  <div className="approval-value">{po.approved_date ? format(new Date(po.approved_date), 'MMM dd, yyyy') : ''}</div>
                </td>
              </tr>
              <tr style={{height: '60px'}}>
                <td colSpan={2}>
                  <div className="signature-line">Signature: ___________________</div>
                </td>
                <td colSpan={2}>
                  <div className="signature-line">Signature: ___________________</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="footer">
          <div className="tiny">Generated on: {format(new Date(), 'MMMM dd, yyyy HH:mm')}</div>
          <div className="tiny">This is a computer-generated document and does not require a signature for processing</div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        :root {
          --brand: #2b6dbb;
          --ink: #0f172a;
          --muted: #6b7280;
          --line: #d1d5db;
          --lite: #eef2f7;
        }

        .po-document .page {
          width: 210mm;
          min-height: 297mm;
          padding: 16mm;
          margin: 0 auto;
          background: white;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .po-document .header {
          display: grid;
          grid-template-columns: 1fr 48%;
          align-items: start;
          column-gap: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid var(--brand);
        }

        .po-document .brand {
          display: flex;
          align-items: flex-start;
        }

        .po-document .brand-logo {
          width: 160px;
          height: auto;
          object-fit: contain;
        }

        .po-document .company {
          margin-top: 8px;
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--ink);
        }

        .po-document .doc-title {
          text-align: right;
          font-size: 32px;
          letter-spacing: 0.06em;
          color: var(--brand);
          font-weight: 800;
          margin: 0 0 10px;
        }

        .po-document .meta {
          border: 1px solid var(--ink);
          border-collapse: collapse;
          width: 100%;
          font-size: 12px;
        }

        .po-document .meta td {
          border: 1px solid var(--ink);
          padding: 6px 8px;
        }

        .po-document .meta td.key {
          width: 38%;
          background: var(--lite);
          font-weight: 600;
        }

        .po-document .bar {
          background: var(--brand);
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.03em;
          padding: 8px 10px;
        }

        .po-document .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .po-document .info-table {
          width: 100%;
          border: 1px solid var(--ink);
          border-collapse: collapse;
          font-size: 12px;
        }

        .po-document .info-table td {
          border: 1px solid var(--ink);
          padding: 7px 10px;
        }

        .po-document .info-table td.key {
          width: 40%;
          background: var(--lite);
          font-weight: 600;
        }

        .po-document .caps {
          text-transform: uppercase;
        }

        .po-document .bold {
          font-weight: 700;
        }

        .po-document .items {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;
          margin-top: 8px;
        }

        .po-document .items th,
        .po-document .items td {
          border: 1px solid var(--ink);
          padding: 8px 8px;
          vertical-align: middle;
        }

        .po-document .items thead th {
          background: var(--brand);
          color: #fff;
          font-weight: 700;
          letter-spacing: 0.02em;
          font-size: 11.5px;
        }

        .po-document .items tbody tr:nth-child(odd) {
          background: var(--lite);
        }

        .po-document .items td.center {
          text-align: center;
        }

        .po-document .items td.right {
          text-align: right;
        }

        .po-document .items td.small {
          font-size: 10.5px;
          color: var(--muted);
        }

        .po-document .code-badge {
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
          color: var(--ink);
        }

        .po-document .financial {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 12px;
          margin-top: 8px;
        }

        .po-document .spacer {
          /* Empty space on left */
        }

        .po-document .summary-table {
          width: 100%;
          border: 1px solid var(--ink);
          border-collapse: collapse;
          font-size: 12px;
        }

        .po-document .summary-table td {
          border: 1px solid var(--ink);
          padding: 8px 10px;
        }

        .po-document .summary-table td.key {
          width: 50%;
          background: var(--lite);
          font-weight: 600;
        }

        .po-document .summary-table td.right {
          text-align: right;
        }

        .po-document .summary-table .total-row {
          background: var(--brand);
          color: #fff;
        }

        .po-document .summary-table .total-row td {
          font-size: 13px;
          padding: 10px;
        }

        .po-document .notes-section {
          margin-top: 8px;
        }

        .po-document .notes-content {
          border: 1px solid var(--line);
          padding: 12px;
          font-size: 12px;
          line-height: 1.6;
          min-height: 60px;
          white-space: pre-wrap;
        }

        .po-document .approvals {
          margin-top: 12px;
        }

        .po-document .approval-table {
          width: 100%;
          border: 1px solid var(--ink);
          border-collapse: collapse;
          font-size: 12px;
        }

        .po-document .approval-table td {
          border: 1px solid var(--ink);
          padding: 10px;
          vertical-align: top;
        }

        .po-document .approval-label {
          font-weight: 600;
          color: var(--muted);
          font-size: 10.5px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .po-document .approval-value {
          font-weight: 700;
          color: var(--ink);
          font-size: 12px;
        }

        .po-document .signature-line {
          margin-top: 30px;
          font-size: 11px;
          color: var(--muted);
        }

        .po-document .footer {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid var(--line);
          text-align: center;
        }

        .po-document .tiny {
          font-size: 10px;
          color: var(--muted);
          line-height: 1.4;
        }

        @media print {
          .po-document .page {
            margin: 0;
            padding: 12mm;
          }
        }
      `}</style>
    </div>
  );
}
