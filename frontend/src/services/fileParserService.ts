import type { SapRawRecord, Gstr2bRawRecord } from '../data/mockDataFallback';
import * as XLSX from 'xlsx';

export interface IngestionResult {
  recordsParsed: number;
  filesProcessed: number;
  sapRecords?: SapRawRecord[];
  gstrRecords?: Gstr2bRawRecord[];
  message: string;
}

export const fileParserService = {
  async parseGstr2bJson(files: File[], defaultGstin: string, defaultPeriod: string): Promise<IngestionResult> {
    const parsedRecords: Gstr2bRawRecord[] = [];
    let filesProcessed = 0;

    for (const file of files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);

        // Handle standard GST Portal GSTR-2B JSON schema
        const docData = json.data || json;
        const gstin = docData.gstin || defaultGstin;
        const returnPeriod = docData.fp || defaultPeriod;
        
        const b2bList = docData.docdata?.b2b || docData.b2b || [];
        const cdnrList = docData.docdata?.cdnr || docData.cdnr || [];
        const b2baList = docData.docdata?.b2ba || docData.b2ba || [];

        let count = 0;
        const addRecord = (supplierName: string, supplierGstin: string, invNum: string, invDate: string, invType: string, val: number, totalTax: number, cgst: number, sgst: number, igst: number, itcavl: string) => {
          count++;
          parsedRecords.push({
            id: `gst-import-${Date.now()}-${count}`,
            gstin,
            supplier_name: supplierName,
            supplier_gstin: supplierGstin,
            invoice_num: invNum,
            invoice_number: invNum,
            invoice_date: invDate,
            invoice_type: invType,
            taxable_value: val - totalTax > 0 ? val - totalTax : val,
            total_tax: totalTax,
            cgst,
            sgst,
            igst,
            itc_available: itcavl,
            return_period: returnPeriod,
          });
        };

        for (const supplier of b2bList) {
          const supplierGstin = supplier.ctin || '';
          const supplierName = supplier.trdnm || supplier.tradeName || supplierGstin;
          const invList = supplier.inv || [];
          for (const inv of invList) {
            const invNum = inv.inum || `INV-${count + 1}`;
            const invDate = inv.idt || new Date().toISOString().split('T')[0];
            const invType = inv.typ || 'B2B';
            const val = parseFloat(inv.val || '0');
            let totalTax = 0, cgst = 0, sgst = 0, igst = 0;
            const items = inv.items || [];
            for (const item of items) {
              const det = item.item_det || item;
              cgst += parseFloat(det.camt || '0');
              sgst += parseFloat(det.samt || '0');
              igst += parseFloat(det.iamt || '0');
              totalTax += parseFloat(det.camt || '0') + parseFloat(det.samt || '0') + parseFloat(det.iamt || '0');
            }
            addRecord(supplierName, supplierGstin, invNum, invDate, invType, val, totalTax, cgst, sgst, igst, inv.itcavl || 'Y');
          }
        }

        for (const supplier of b2baList) {
          const supplierGstin = supplier.ctin || '';
          const supplierName = supplier.trdnm || supplier.tradeName || supplierGstin;
          const invList = supplier.inv || [];
          for (const inv of invList) {
            const invNum = inv.inum || `INV-${count + 1}`;
            const invDate = inv.idt || new Date().toISOString().split('T')[0];
            const invType = inv.typ || 'B2BA';
            const val = parseFloat(inv.val || '0');
            let totalTax = 0, cgst = 0, sgst = 0, igst = 0;
            const items = inv.items || [];
            for (const item of items) {
              const det = item.item_det || item;
              cgst += parseFloat(det.camt || '0');
              sgst += parseFloat(det.samt || '0');
              igst += parseFloat(det.iamt || '0');
              totalTax += parseFloat(det.camt || '0') + parseFloat(det.samt || '0') + parseFloat(det.iamt || '0');
            }
            addRecord(supplierName, supplierGstin, invNum, invDate, invType, val, totalTax, cgst, sgst, igst, inv.itcavl || 'Y');
          }
        }

        for (const supplier of cdnrList) {
          const supplierGstin = supplier.ctin || '';
          const supplierName = supplier.trdnm || supplier.tradeName || supplierGstin;
          const ntList = supplier.nt || [];
          for (const nt of ntList) {
            const ntNum = nt.ntNum || `NT-${count + 1}`;
            const ntDate = nt.ntDt || new Date().toISOString().split('T')[0];
            const ntType = nt.ntty || 'CDNR';
            const val = parseFloat(nt.val || '0');
            let totalTax = 0, cgst = 0, sgst = 0, igst = 0;
            const items = nt.items || [];
            for (const item of items) {
              const det = item.item_det || item;
              cgst += parseFloat(det.camt || '0');
              sgst += parseFloat(det.samt || '0');
              igst += parseFloat(det.iamt || '0');
              totalTax += parseFloat(det.camt || '0') + parseFloat(det.samt || '0') + parseFloat(det.iamt || '0');
            }
            const mult = ntType === 'C' ? -1 : 1;
            addRecord(supplierName, supplierGstin, ntNum, ntDate, ntType, val * mult, totalTax * mult, cgst * mult, sgst * mult, igst * mult, nt.itcavl || 'Y');
          }
        }
        filesProcessed++;
      } catch (err) {
        console.error(`Error parsing GSTR-2B JSON file ${file.name}:`, err);
      }
    }

    return {
      recordsParsed: parsedRecords.length,
      filesProcessed,
      gstrRecords: parsedRecords,
      message: `Successfully parsed ${parsedRecords.length} records from ${filesProcessed} GSTR-2B file(s)!`,
    };
  },

  async parseSapFile(file: File, defaultGstin: string, defaultPeriod: string): Promise<IngestionResult> {
    try {
      const parsedRecords: SapRawRecord[] = [];

      // Check if XLSX or JSON or CSV text format
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        rows.forEach((row, idx) => {
          let docDate = row.invoice_date || row.posting_date || new Date().toISOString().split('T')[0];
          if (docDate instanceof Date) {
            docDate = docDate.toISOString().split('T')[0];
          } else if (typeof docDate === 'number') {
            docDate = new Date(Math.round((docDate - 25569) * 86400 * 1000)).toISOString().split('T')[0];
          }

          parsedRecords.push({
            id: `sap-import-xls-${Date.now()}-${idx}`,
            gstin: row.own_gstin || defaultGstin,
            vendor_name: row.vendor_name || 'Vendor',
            vendor_gstin: row.vendor_gstin || '',
            invoice_num: String(row.invoice_num || row.sap_doc_no || `SAP-INV-${idx}`),
            document_number: String(row.sap_doc_no || row.invoice_num || `51000${idx}`),
            invoice_date: String(docDate),
            document_date: String(docDate),
            taxable_value: parseFloat(row.taxable_base || row.taxable_value || '0'),
            total_tax: parseFloat(row.total_tax || '0'),
            cgst: parseFloat(row.cgst || '0'),
            sgst: parseFloat(row.sgst || '0'),
            igst: parseFloat(row.igst || '0'),
            return_period: defaultPeriod,
          });
        });
      } else if (fileName.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        const rows = Array.isArray(json) ? json : json.records || [];
        rows.forEach((row: any, idx: number) => {
          parsedRecords.push({
            id: `sap-import-${Date.now()}-${idx}`,
            gstin: row.gstin || defaultGstin,
            vendor_name: row.vendor_name || row.supplier_name || 'Vendor',
            vendor_gstin: row.vendor_gstin || row.gstin || '',
            invoice_num: row.invoice_num || row.doc_num || `SAP-INV-${idx}`,
            document_number: row.document_number || row.invoice_num || `51000${idx}`,
            invoice_date: row.invoice_date || row.doc_date || new Date().toISOString().split('T')[0],
            document_date: row.document_date || row.invoice_date || new Date().toISOString().split('T')[0],
            taxable_value: parseFloat(row.taxable_value || '0'),
            total_tax: parseFloat(row.total_tax || '0'),
            cgst: parseFloat(row.cgst || '0'),
            sgst: parseFloat(row.sgst || '0'),
            igst: parseFloat(row.igst || '0'),
            return_period: row.return_period || defaultPeriod,
          });
        });
      } else {
        // CSV Text Parser
        const text = await file.text();
        const lines = text.split('\n');
        lines.slice(1).forEach((line, idx) => {
          if (!line.trim()) return;
          const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 4) {
            parsedRecords.push({
              id: `sap-import-csv-${Date.now()}-${idx}`,
              gstin: defaultGstin,
              vendor_name: cols[0] || 'Vendor',
              vendor_gstin: cols[1] || '',
              invoice_num: cols[2] || `SAP-INV-${idx}`,
              document_number: `51000${idx}`,
              invoice_date: cols[3] || new Date().toISOString().split('T')[0],
              document_date: cols[3] || new Date().toISOString().split('T')[0],
              taxable_value: parseFloat(cols[4] || '0'),
              total_tax: parseFloat(cols[5] || '0'),
              cgst: parseFloat(cols[6] || '0'),
              sgst: parseFloat(cols[7] || '0'),
              igst: parseFloat(cols[8] || '0'),
              return_period: defaultPeriod,
            });
          }
        });
      }

      return {
        recordsParsed: parsedRecords.length,
        filesProcessed: 1,
        sapRecords: parsedRecords,
        message: `Successfully parsed ${parsedRecords.length} SAP purchase register records!`,
      };
    } catch (err: any) {
      console.error('Error parsing SAP file:', err);
      throw new Error(`Failed to parse SAP file: ${err.message}`);
    }
  },
};
