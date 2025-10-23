import { useRef } from 'react';
import { PurchaseOrder } from '@/types/purchaseOrder';
import { Button } from '@/components/ui/button';
import { Download, Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { useCompany } from '@/contexts/CompanyContext';

interface PoDocumentDreamTeamProps {
  purchaseOrder: PurchaseOrder;
  onClose?: () => void;
}

export function PoDocumentDreamTeam({ purchaseOrder, onClose }: PoDocumentDreamTeamProps) {
  const { selectedCompany } = useCompany();
  const containerRef = useRef<HTMLDivElement>(null);

  const printInIframe = async () => {
    if (!containerRef.current) return;

    const clonedContent = containerRef.current.cloneNode(true) as HTMLElement;
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((style) => style.outerHTML)
      .join('\n');

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Purchase Order - ${purchaseOrder.po_number}</title>
          ${styles}
        </head>
        <body>
          ${clonedContent.outerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    const images = iframeDoc.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) resolve(null);
            else {
              img.onload = () => resolve(null);
              img.onerror = () => resolve(null);
            }
          })
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    iframe.contentWindow?.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  const handlePrint = () => {
    printInIframe();
  };

  const handleDownloadPDF = () => {
    printInIframe();
  };

  const po = purchaseOrder;
  
  // Company details with fallback
  const companyInfo = po.company || selectedCompany;
  const companyName = companyInfo?.name || 'DREAM TEAM MEDIA (PRIVATE) LIMITED';
  const companyAddress = companyInfo?.address || '9th Floor, No. 10, Raymond Road, Nugegoda';
  const companyLogoUrl = companyInfo?.logo_url;
  
  // Display only actual items from the PO
  const displayItems = po.items || [];

  // Calculate totals
  const subtotal = po.total_amount || 0;
  const discountAmount = po.discount_amount || 0;
  const taxAmount = po.tax_amount || 0;
  const grandTotal = po.final_amount || 0;
  const discountPercent = subtotal > 0 ? ((discountAmount / subtotal) * 100).toFixed(2) : '0.00';

  // Fallback values for missing fields
  const prNumber = po.pr?.pr_number || 'N/A';
  const mrnNumber = po.mrn_number || '';
  const requestPerson = po.request_person || po.created_by_profile?.full_name || 'N/A';
  const branch = po.branch || 'Head Office';
  const department = po.department || 'N/A';
  const deliveryAddress = po.delivery_address || selectedCompany?.address || 'To be confirmed';
  const documentNo = po.document_number || 'DTM/OPS/GFO/003';
  const revisionNo = po.revision_number || '02';
  const revisionDate = po.revision_date || '2025/07/07';

  // Approval info
  const preparedBy = po.created_by_profile?.full_name || 'N/A';
  const preparedDate = po.created_at ? format(new Date(po.created_at), 'yyyy / MM / dd') : '';
  const firstApprover = po.merchandiser_profile?.full_name || '';
  const firstApprovalDate = po.merchandiser_approved_date ? format(new Date(po.merchandiser_approved_date), 'yyyy / MM / dd') : '';
  const secondApprover = po.dept_head_profile?.full_name || '';
  const secondApprovalDate = po.department_head_approved_date ? format(new Date(po.department_head_approved_date), 'yyyy / MM / dd') : '';

  // Watermark for draft status
  const showWatermark = po.status === 'draft';

  return (
    <div className="relative">
      <div className="no-print flex gap-2 mb-4 justify-end">
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button variant="outline" onClick={handleDownloadPDF}>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        )}
      </div>

      <div ref={containerRef}>
        <style>{`
          :root {
            --accent: #00B578;
            --text: #222;
            --muted: #666;
            --line: #cfd6dd;
            --table-head: #e6e9ed;
            --black: #000;
          }

          @page { 
            size: A4; 
            margin: 12mm; 
          }

          @media print {
            body { 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
            }
            .no-print { 
              display: none !important; 
            }
          }

          .dt-page {
            width: 210mm;
            min-height: 297mm;
            margin: auto;
            padding: 14mm 14mm 12mm;
            position: relative;
            background: #fff;
            color: var(--text);
            font-family: Calibri, "Segoe UI", Arial, sans-serif;
            font-size: 12px;
            line-height: 1.35;
          }

          .dt-page.watermark::after {
            content: "D R A F T";
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            font-size: 120px;
            font-weight: 700;
            letter-spacing: 14px;
            color: rgba(0, 0, 0, 0.07);
            transform: rotate(-30deg);
          }

          .dt-header {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10mm;
            align-items: start;
            border-bottom: 1.2px solid var(--line);
            padding-bottom: 8mm;
            margin-bottom: 8mm;
          }

          .dt-brand {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 10px;
            align-items: center;
          }

          .dt-logo {
            width: 34mm;
            height: 20mm;
            border: 1.2px solid var(--line);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            color: var(--muted);
            font-weight: 600;
          }

          .dt-brand h1 {
            margin: 0 0 2px;
            font-size: 16px;
            letter-spacing: 0.2px;
          }

          .dt-brand small {
            color: var(--muted);
          }

          .dt-company {
            text-align: right;
            font-size: 11px;
          }

          .dt-company b {
            display: block;
            font-size: 12px;
            margin-bottom: 2px;
          }

          .dt-company a {
            color: var(--text);
            text-decoration: none;
          }

          .dt-po-title {
            text-align: center;
            font-weight: 700;
            letter-spacing: 1.2px;
            margin: 12mm 0 6mm;
            font-size: 13px;
          }

          .dt-po-no {
            position: absolute;
            right: 14mm;
            top: 20mm;
            text-align: right;
          }

          .dt-po-no label {
            font-size: 11px;
            color: var(--muted);
            display: block;
            margin-bottom: 3px;
          }

          .dt-po-no .box {
            width: 38mm;
            height: 11mm;
            border: 1.4px solid var(--line);
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 13px;
          }

          .dt-details {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 10mm;
            margin-bottom: 8mm;
          }

          .dt-kv {
            display: grid;
            grid-template-columns: 34mm 1fr;
            row-gap: 5px;
            column-gap: 6mm;
          }

          .dt-kv .k {
            color: var(--text);
          }

          .dt-kv .v {
            border-bottom: 1px dotted #9aa3ab;
            min-height: 13px;
            padding: 0 2px;
          }

          .dt-kv .stack {
            display: grid;
            gap: 5px;
          }

          .dt-item-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6mm;
          }

          .dt-item-table th,
          .dt-item-table td {
            border: 1px solid var(--line);
            padding: 7px 6px;
            vertical-align: top;
          }

          .dt-item-table thead th {
            background: var(--table-head);
            font-weight: 700;
            text-align: left;
          }

          .dt-item-table th.num,
          .dt-item-table td.num {
            width: 18mm;
            text-align: center;
          }

          .dt-item-table th.qty,
          .dt-item-table td.qty {
            width: 18mm;
            text-align: center;
          }

          .dt-item-table th.uom,
          .dt-item-table td.uom {
            width: 20mm;
            text-align: center;
          }

          .dt-item-table th.price,
          .dt-item-table td.price,
          .dt-item-table th.disc,
          .dt-item-table td.disc,
          .dt-item-table th.total,
          .dt-item-table td.total {
            width: 28mm;
            text-align: right;
          }

          .dt-item-table td {
            height: 10.6mm;
          }

          .dt-totals-wrap {
            display: grid;
            grid-template-columns: 1fr 70mm;
            gap: 6mm;
            align-items: start;
            margin-top: 6mm;
          }

          .dt-totals {
            border: 1px solid var(--line);
          }

          .dt-totals .row {
            display: grid;
            grid-template-columns: 1fr 38mm;
            align-items: center;
            border-bottom: 1px solid var(--line);
          }

          .dt-totals .row:last-child {
            border-bottom: none;
          }

          .dt-totals .row > div {
            padding: 7px 8px;
          }

          .dt-totals .label {
            background: #f7f8fa;
          }

          .dt-totals .grand .label {
            background: #000;
            color: #fff;
            font-weight: 700;
            letter-spacing: 0.4px;
          }

          .dt-totals .grand .value {
            font-weight: 800;
          }

          .dt-approvals {
            margin-top: 10mm;
            border-top: 1.2px solid var(--line);
            padding-top: 8mm;
          }

          .dt-approvals h4 {
            margin: 0 0 6px;
            font-size: 12px;
          }

          .dt-approvals .note {
            font-size: 11px;
            color: var(--muted);
            margin-bottom: 6px;
            font-style: italic;
          }

          .dt-sig-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8mm;
          }

          .dt-sig-card {
            border: 1px solid var(--line);
            border-radius: 4px;
            padding: 6mm;
          }

          .dt-sig-card .row {
            display: grid;
            grid-template-columns: 18mm 1fr;
            gap: 6mm;
            margin: 6px 0;
          }

          .dt-sig-card .line {
            border-bottom: 1px dotted #9aa3ab;
            height: 14px;
            padding: 0 2px;
          }

          .dt-footer {
            position: absolute;
            left: 14mm;
            right: 14mm;
            bottom: 10mm;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 1mm;
            border-top: 1px solid var(--line);
            padding-top: 4mm;
            color: var(--muted);
          }

          .dt-footer div {
            font-size: 11px;
          }

          .dt-footer .center {
            text-align: center;
          }

          .dt-footer .right {
            text-align: right;
          }
        `}</style>

        <div className={`dt-page ${showWatermark ? 'watermark' : ''}`}>
          {/* Header */}
          <div className="dt-header">
            <div className="dt-brand">
              <div className="dt-logo">
                {companyLogoUrl ? (
                  <img 
                    src={companyLogoUrl} 
                    alt={companyName} 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  'LOGO'
                )}
              </div>
              <div>
                <h1>{companyInfo?.code === 'DTM' ? 'Dreamteam' : companyName}</h1>
                {companyInfo?.code === 'DTM' && <small>Creative • Media • Solutions</small>}
              </div>
            </div>
            <div className="dt-company">
              <b>{companyName.toUpperCase()}</b>
              {companyAddress && (
                <>
                  {companyAddress}<br />
                </>
              )}
              077 771 6690 &nbsp; | &nbsp; <a href="mailto:hello@dreamteam.lk">hello@dreamteam.lk</a><br />
              <a href="https://www.dreamteam.lk">www.dreamteam.lk</a>
            </div>
          </div>

          {/* Title and PO Number */}
          <div className="dt-po-title">PURCHASE ORDER</div>
          <div className="dt-po-no">
            <label>PO No.</label>
            <div className="box">{po.po_number}</div>
          </div>

          {/* Two-column details */}
          <div className="dt-details">
            {/* Left: Supplier */}
            <div className="dt-kv">
              <div className="k">Supplier's Name</div>
              <div className="v">{po.supplier?.name || ''}</div>
              
              <div className="k">Supplier's Address</div>
              <div className="v stack">
                <div style={{ borderBottom: '1px dotted #9aa3ab', height: '13px' }}></div>
                <div style={{ borderBottom: '1px dotted #9aa3ab', height: '13px' }}></div>
                <div style={{ borderBottom: '1px dotted #9aa3ab', height: '13px' }}></div>
              </div>
              
              <div className="k">Telephone</div>
              <div className="v">{po.supplier?.phone || ''}</div>
              
              <div className="k">Email</div>
              <div className="v">{po.supplier?.email || ''}</div>
            </div>

            {/* Right: PO Metadata */}
            <div className="dt-kv">
              <div className="k">P.R. No.</div>
              <div className="v">{prNumber}</div>
              
              <div className="k">MRN No.</div>
              <div className="v">{mrnNumber}</div>
              
              <div className="k">Date</div>
              <div className="v">{po.po_date ? format(new Date(po.po_date), 'yyyy / MM / dd') : ''}</div>
              
              <div className="k">Request Person</div>
              <div className="v">{requestPerson}</div>
              
              <div className="k">Branch</div>
              <div className="v">{branch}</div>
              
              <div className="k">Department</div>
              <div className="v">{department}</div>
              
              <div className="k">Delivery Address</div>
              <div className="v">{deliveryAddress}</div>
              
              <div className="k">Delivery Date</div>
              <div className="v">
                {po.expected_delivery_date ? format(new Date(po.expected_delivery_date), 'yyyy / MM / dd') : ''}
              </div>
            </div>
          </div>

          {/* Items table */}
          <table className="dt-item-table">
            <thead>
              <tr>
                <th className="num">No.</th>
                <th>Description of Items</th>
                <th className="qty">Qty</th>
                <th className="uom">UOM</th>
                <th className="price">Unit Price (Rs.)</th>
                <th className="disc">Line Discount (Rs.)</th>
                <th className="total">Total Cost (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, index) => (
                <tr key={item.id || `row-${index}`}>
                  <td className="num">{item.item_name ? index + 1 : ''}</td>
                  <td>{item.item_name || ''}</td>
                  <td className="qty">{item.quantity_ordered || ''}</td>
                  <td className="uom">{item.unit_of_measure || ''}</td>
                  <td className="price">
                    {item.unit_price ? item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                  </td>
                  <td className="disc">
                    {item.line_discount_amount ? item.line_discount_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                  </td>
                  <td className="total">
                    {item.total_price ? item.total_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="dt-totals-wrap">
            <div></div>
            <div className="dt-totals">
              <div className="row">
                <div className="label">Sub Total</div>
                <div className="value">{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="row">
                <div className="label">Discount ({discountPercent}%)</div>
                <div className="value">{discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="row">
                <div className="label">Tax (VAT)</div>
                <div className="value">{taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="row grand">
                <div className="label">TOTAL</div>
                <div className="value">{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* Approvals */}
          <div className="dt-approvals">
            <div className="note">
              *Note: Please make sure to place the name, signature and date in the given space accordingly.
            </div>

            <div className="dt-sig-grid">
              <div className="dt-sig-card">
                <h4>Prepared by :</h4>
                <div className="row">
                  <div>Name</div>
                  <div className="line">{preparedBy}</div>
                </div>
                <div className="row">
                  <div>Signature</div>
                  <div className="line"></div>
                </div>
                <div className="row">
                  <div>Date</div>
                  <div className="line">{preparedDate}</div>
                </div>
              </div>

              <div className="dt-sig-card">
                <h4>1<sup>st</sup> Approval :</h4>
                <div className="row">
                  <div>Name</div>
                  <div className="line">{firstApprover}</div>
                </div>
                <div className="row">
                  <div>Signature</div>
                  <div className="line"></div>
                </div>
                <div className="row">
                  <div>Date</div>
                  <div className="line">{firstApprovalDate}</div>
                </div>
              </div>

              <div className="dt-sig-card">
                <h4>2<sup>nd</sup> Approval :</h4>
                <div className="row">
                  <div>Name</div>
                  <div className="line">{secondApprover}</div>
                </div>
                <div className="row">
                  <div>Signature</div>
                  <div className="line"></div>
                </div>
                <div className="row">
                  <div>Date</div>
                  <div className="line">{secondApprovalDate}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="dt-footer">
            <div>Document No : {documentNo}</div>
            <div className="center">Revision No : {revisionNo}</div>
            <div className="right">Date of Revision : {revisionDate}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
