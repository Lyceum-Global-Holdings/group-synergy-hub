import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { format } from "date-fns";
import { useMemo, useRef } from "react";
import tuhLogo from "@/assets/tuh-logo.png";
import { useCompany } from "@/contexts/CompanyContext";

interface DeliveryNoteDocumentProps {
  issueId: string;
  issueDetails: any;
  issueItems: any[];
}

interface GroupedItem {
  productName: string;
  productCode: string;
  color: string;
  description: string;
  sizes: Array<{
    size: string;
    quantity: number;
  }>;
  subtotal: number;
}

export function DeliveryNoteDocument({ issueId, issueDetails, issueItems }: DeliveryNoteDocumentProps) {
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
          <title>Delivery Note</title>
          <style>
            @page {
              size: A4;
              margin: 12mm;
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

  // Group items by product and color
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: GroupedItem } = {};
    
    issueItems?.forEach(item => {
      const fg = item.finished_goods || {};
      const cpoItem = item.sales_order_items?.customer_po_items || {};
      
      // Prioritize CPO data, fallback to finished goods
      const itemName = cpoItem.item_name || fg.product_name || 'N/A';
      const color = cpoItem.color || fg.color || 'N/A';
      const description = cpoItem.description || cpoItem.item_name || fg.product_name || 'N/A';
      const size = cpoItem.size || fg.size || 'N/A';
      
      const key = `${itemName}_${color}`;
      
      if (!groups[key]) {
        groups[key] = {
          productName: itemName,
          productCode: fg.product_code || '',
          color: color,
          description: description,
          sizes: [],
          subtotal: 0
        };
      }
      
      groups[key].sizes.push({
        size: size,
        quantity: item.quantity_issued || 0
      });
      groups[key].subtotal += item.quantity_issued || 0;
    });
    
    return Object.values(groups);
  }, [issueItems]);

  const totalQuantity = useMemo(() => 
    issueItems?.reduce((sum, item) => sum + (item.quantity_issued || 0), 0) || 0,
    [issueItems]
  );

  return (
    <div ref={containerRef} className="delivery-note-document">
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
      </div>

      <div className="page">
        {/* Top header */}
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
            <h2 className="doc-title">DELIVERY NOTE</h2>
            <table className="meta" aria-label="Document Meta">
              <tbody>
                <tr>
                  <td className="key">Order Date</td>
                  <td>{issueDetails?.sales_orders?.order_date ? format(new Date(issueDetails.sales_orders.order_date), 'MMMM dd, yyyy') : ''}</td>
                </tr>
                <tr>
                  <td className="key">Order #</td>
                  <td>{issueDetails?.sales_orders?.order_number || ''}</td>
                </tr>
                <tr>
                  <td className="key">Delivery Note #</td>
                  <td>{issueDetails?.issue_number || ''}</td>
                </tr>
                <tr>
                  <td className="key">Gate pass NO</td>
                  <td></td>
                </tr>
                <tr>
                  <td className="key">Dispatch Date</td>
                  <td>{issueDetails?.issue_date ? format(new Date(issueDetails.issue_date), 'MMMM dd, yyyy') : ''}</td>
                </tr>
                <tr>
                  <td className="key">Delivery Method</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Addresses */}
        <div className="addr-grid">
          <div>
            <div className="bar">SHIPPING ADDRESS</div>
            <table className="addr-table">
              <tbody>
                {issueDetails?.sales_orders?.delivery_address ? (
                  issueDetails.sales_orders.delivery_address.split(',').slice(0, 4).map((line: string, i: number) => (
                    <tr key={i}>
                      <td className="caps">{line.trim()}</td>
                    </tr>
                  ))
                ) : (
                  <>
                    <tr><td className="caps">THE UNIFORM HUB (PVT) LIMITED</td></tr>
                    <tr><td className="caps">IHALAGAMA,</td></tr>
                    <tr><td className="caps">WILBAWA,</td></tr>
                    <tr><td className="caps">KURUNEGALA.</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <div className="bar">INVOICE ADDRESS</div>
            <table className="addr-table">
              <tbody>
                <tr><td className="right caps">{issueDetails?.sales_orders?.customers?.customer_name?.toUpperCase() || ''}</td></tr>
                <tr><td className="right caps">{issueDetails?.sales_orders?.customers?.address?.toUpperCase() || ''}</td></tr>
                <tr><td className="right caps">{issueDetails?.sales_orders?.customers?.phone || ''}</td></tr>
                <tr><td className="right caps">{issueDetails?.sales_orders?.customers?.email || ''}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Items */}
        <table className="items" aria-label="Items">
          <thead>
            <tr>
              <th style={{width: '24%'}}>Item</th>
              <th style={{width: '16%'}}>Colour</th>
              <th>Description</th>
              <th style={{width: '10%'}}>Size</th>
              <th style={{width: '10%'}}>QTY</th>
            </tr>
          </thead>
          <tbody>
            {groupedItems.map((group, groupIndex) => (
              <>
                {group.sizes.map((sizeItem, sizeIndex) => (
                  <tr key={`${groupIndex}-${sizeIndex}`}>
                    <td className={sizeIndex === 0 ? "caps bold" : ""}>
                      {sizeIndex === 0 ? group.productName : ''}
                    </td>
                    <td className={sizeIndex === 0 ? "caps" : ""}>
                      {sizeIndex === 0 ? group.color : ''}
                    </td>
                    <td className={sizeIndex === 0 ? "caps bold" : ""}>
                      {sizeIndex === 0 ? group.description : ''}
                    </td>
                    <td className={sizeIndex === 0 ? "caps bold center" : "caps center"}>
                      {sizeItem.size}
                    </td>
                    <td className={sizeIndex === 0 ? "right bold" : "right"}>
                      {sizeItem.quantity}
                    </td>
                  </tr>
                ))}
              </>
            ))}
            
            <tr>
              <td colSpan={4} className="right bold caps">TOTAL</td>
              <td className="right bold">{totalQuantity}</td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        <div className="notes">
          <p>
            Notice must be given to us of any goods not received within 10 days taken from the date of dispatch stated on invoice.
            Any shortage or damage must be notified within 72 hours of receipt of goods. Complaints can only be accepted if made in
            writing within 30 days of receipt of goods. No goods may be returned without prior authorisation from company.
          </p>
        </div>

        {/* Thank you bar */}
        <div className="thankyou">THANK YOU FOR YOUR BUSINESS!</div>
        <div className="tiny">This is a computer generated statement and no signature is required</div>

        {/* Acceptance */}
        <table className="accept" aria-label="Acceptance">
          <tbody>
            <tr>
              <td className="w-40">STOCK ACCEPTED BY</td>
              <td>NIC NO.</td>
              <td>VEHICLE NO</td>
              <td>SIGNATURE</td>
            </tr>
            <tr>
              <td style={{height: '56px'}}></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
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

        .delivery-note-document .page {
          width: 210mm;
          min-height: 297mm;
          padding: 18mm 16mm 16mm;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .delivery-note-document .header {
          display: grid;
          grid-template-columns: 1fr 52%;
          align-items: start;
          column-gap: 16px;
        }

        .delivery-note-document .brand {
          display: flex;
          align-items: flex-start;
        }

        .delivery-note-document .brand-logo {
          width: 180px;
          height: auto;
          object-fit: contain;
        }

        .delivery-note-document .company {
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.45;
        }

        .delivery-note-document .doc-title {
          text-align: right;
          font-size: 32px;
          letter-spacing: 0.06em;
          color: var(--brand);
          font-weight: 800;
          margin: 0 0 8px;
        }

        .delivery-note-document .meta {
          border: 1px solid var(--ink);
          border-collapse: collapse;
          width: 100%;
          font-size: 12.5px;
        }

        .delivery-note-document .meta td {
          border: 1px solid var(--ink);
          padding: 6px 8px;
        }

        .delivery-note-document .meta td.key {
          width: 36%;
          background: #f7f7f7;
          font-weight: 600;
        }

        .delivery-note-document .bar {
          background: var(--brand);
          color: #fff;
          font-weight: 700;
          font-size: 12.5px;
          letter-spacing: 0.03em;
          padding: 8px 10px;
        }

        .delivery-note-document .addr-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .delivery-note-document .addr-table {
          width: 100%;
          border: 1px solid var(--ink);
          border-collapse: collapse;
          font-size: 13px;
        }

        .delivery-note-document .addr-table td {
          border: 1px solid var(--ink);
          padding: 8px 10px;
          height: 28px;
          vertical-align: middle;
        }

        .delivery-note-document .addr-table .right {
          text-align: right;
          font-weight: 700;
        }

        .delivery-note-document .caps {
          text-transform: uppercase;
        }

        .delivery-note-document .items {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .delivery-note-document .items th,
        .delivery-note-document .items td {
          border: 1px solid var(--ink);
          padding: 8px 10px;
          vertical-align: middle;
        }

        .delivery-note-document .items thead th {
          background: var(--brand);
          color: #fff;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: capitalize;
          font-size: 12.5px;
        }

        .delivery-note-document .items tbody tr:nth-child(odd) {
          background: var(--lite);
        }

        .delivery-note-document .items td.center {
          text-align: center;
        }

        .delivery-note-document .items td.right {
          text-align: right;
        }

        .delivery-note-document .items td.bold {
          font-weight: 800;
        }

        .delivery-note-document .notes {
          font-size: 12px;
          line-height: 1.5;
          margin-top: 8px;
        }

        .delivery-note-document .thankyou {
          background: var(--brand);
          color: #fff;
          text-align: center;
          font-weight: 800;
          letter-spacing: 0.03em;
          padding: 8px 10px;
          margin-top: 8px;
        }

        .delivery-note-document .tiny {
          text-align: center;
          font-size: 11px;
          color: #111;
          margin-top: 2px;
        }

        .delivery-note-document .accept {
          margin-top: 10px;
          border: 1px solid var(--ink);
          border-collapse: collapse;
          width: 100%;
          font-size: 12.5px;
        }

        .delivery-note-document .accept td {
          border: 1px solid var(--ink);
          padding: 8px 10px;
          height: 36px;
        }

        .delivery-note-document .accept .w-40 {
          width: 40%;
        }

        @page {
          size: A4;
          margin: 12mm;
        }
      `}</style>
    </div>
  );
}
