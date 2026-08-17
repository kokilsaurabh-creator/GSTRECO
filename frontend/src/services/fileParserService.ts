import type { SapRawRecord, Gstr2bRawRecord } from '../data/mockDataFallback';

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

        let count = 0;
        for (const supplier of b2bList) {
          const supplierGstin = supplier.ctin || '';
          const supplierName = supplier.trdnm || supplier.tradeName || supplierGstin;
          const invList = supplier.inv || [];

          for (const inv of invList) {
            count++;
            const invNum = inv.inum || `INV-${count}`;
            const invDate = inv.idt || new Date().toISOString().split('T')[0];
            const invType = inv.typ || 'B2B';
            const val = parseFloat(inv.val || '0');

            let totalTax = 0;
            let cgst = 0;
            let sgst = 0;
            let igst = 0;

            const items = inv.items || [];
            for (const item of items) {
              const det = item.item_det || item;
              cgst += parseFloat(det.camt || '0');
              sgst += parseFloat(det.samt || '0');
              igst += parseFloat(det.iamt || '0');
              totalTax += parseFloat(det.camt || '0') + parseFloat(det.samt || '0') + parseFloat(det.iamt || '0');
            }

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
              itc_available: inv.itcavl || 'Y',
              return_period: returnPeriod,
            });
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
      const text = await file.text();
      const parsedRecords: SapRawRecord[] = [];

      // Check if JSON format or CSV text format
      if (file.name.endsWith('.json')) {
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
