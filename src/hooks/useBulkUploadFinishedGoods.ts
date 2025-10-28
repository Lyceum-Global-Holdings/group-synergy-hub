import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

export interface BulkUploadError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

export interface BulkUploadResult {
  success: number;
  failed: number;
  skipped: number;
  errors: BulkUploadError[];
}

interface ParsedRow {
  product_code: string;
  product_name: string;
  unit_of_measure: string;
  [key: string]: any;
}

const VALID_UNITS = ['pcs', 'kg', 'm', 'box', 'set', 'ltr', 'ft', 'yd', 'sqm', 'pair'];
const VALID_QUALITY_STATUS = ['approved', 'pending', 'rejected'];
const VALID_STATUS = ['active', 'inactive'];

export const useBulkUploadFinishedGoods = (companyId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const parseCSV = (file: File): Promise<ParsedRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            raw: false,
            defval: null 
          });
          resolve(jsonData as ParsedRow[]);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const validateRow = (row: ParsedRow, index: number, existingCodes: Set<string>): BulkUploadError[] => {
    const errors: BulkUploadError[] = [];
    const rowNum = index + 2; // +2 for header row and 0-index

    // Required fields
    if (!row.product_code?.trim()) {
      errors.push({ row: rowNum, field: 'product_code', message: 'Product code is required' });
    } else if (existingCodes.has(row.product_code.trim())) {
      errors.push({ row: rowNum, field: 'product_code', message: 'Duplicate product code in CSV', value: row.product_code });
    }

    if (!row.product_name?.trim()) {
      errors.push({ row: rowNum, field: 'product_name', message: 'Product name is required' });
    }

    if (!row.unit_of_measure?.trim()) {
      errors.push({ row: rowNum, field: 'unit_of_measure', message: 'Unit of measure is required' });
    } else if (!VALID_UNITS.includes(row.unit_of_measure.toLowerCase())) {
      errors.push({ 
        row: rowNum, 
        field: 'unit_of_measure', 
        message: `Invalid unit. Must be one of: ${VALID_UNITS.join(', ')}`,
        value: row.unit_of_measure 
      });
    }

    // Optional numeric fields
    const numericFields = ['selling_price', 'standard_cost', 'minimum_stock', 'maximum_stock', 'reorder_point', 'lead_time_days', 'current_stock'];
    numericFields.forEach(field => {
      if (row[field] !== null && row[field] !== undefined && row[field] !== '') {
        const num = parseFloat(row[field]);
        if (isNaN(num) || num < 0) {
          errors.push({ row: rowNum, field, message: `${field} must be a positive number`, value: row[field] });
        }
      }
    });

    // Enum validations
    if (row.quality_status && !VALID_QUALITY_STATUS.includes(row.quality_status.toLowerCase())) {
      errors.push({ 
        row: rowNum, 
        field: 'quality_status', 
        message: `Must be one of: ${VALID_QUALITY_STATUS.join(', ')}`,
        value: row.quality_status 
      });
    }

    if (row.status && !VALID_STATUS.includes(row.status.toLowerCase())) {
      errors.push({ 
        row: rowNum, 
        field: 'status', 
        message: `Must be one of: ${VALID_STATUS.join(', ')}`,
        value: row.status 
      });
    }

    return errors;
  };

  const transformRow = (row: ParsedRow) => {
    const transformed: any = {
      company_id: companyId,
      product_code: row.product_code?.trim(),
      product_name: row.product_name?.trim(),
      unit_of_measure: row.unit_of_measure?.toLowerCase().trim(),
      style_no: row.style_no?.trim() || null,
      size: row.size?.trim() || null,
      color: row.color?.trim() || null,
      variant: row.variant?.trim() || null,
      category: row.category?.trim() || null,
      description: row.description?.trim() || null,
      quality_status: row.quality_status?.toLowerCase().trim() || 'approved',
      status: row.status?.toLowerCase().trim() || 'active',
    };

    // Numeric fields
    if (row.selling_price) transformed.selling_price = parseFloat(row.selling_price);
    if (row.standard_cost) transformed.standard_cost = parseFloat(row.standard_cost);
    if (row.minimum_stock) transformed.minimum_stock = parseFloat(row.minimum_stock);
    if (row.maximum_stock) transformed.maximum_stock = parseFloat(row.maximum_stock);
    if (row.reorder_point) transformed.reorder_point = parseFloat(row.reorder_point);
    if (row.lead_time_days) transformed.lead_time_days = parseInt(row.lead_time_days);
    if (row.current_stock) transformed.current_stock = parseFloat(row.current_stock);
    if (row.product_master_code) transformed.product_master_code = row.product_master_code.trim();

    return transformed;
  };

  const uploadMutation = useMutation({
    mutationFn: async ({ 
      rows, 
      mode 
    }: { 
      rows: ParsedRow[]; 
      mode: 'skip' | 'update' | 'new-only' 
    }): Promise<BulkUploadResult> => {
      const result: BulkUploadResult = {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: []
      };

      // Check for existing product codes in DB
      const productCodes = rows.map(r => r.product_code?.trim()).filter(Boolean);
      const { data: existingProducts } = await supabase
        .from('finished_goods')
        .select('product_code, id')
        .eq('company_id', companyId)
        .in('product_code', productCodes);

      const existingCodesMap = new Map(
        existingProducts?.map(p => [p.product_code, p.id]) || []
      );

      // Validate all rows
      const csvCodesSet = new Set<string>();
      const allErrors: BulkUploadError[] = [];
      
      rows.forEach((row, index) => {
        const errors = validateRow(row, index, csvCodesSet);
        if (errors.length > 0) {
          allErrors.push(...errors);
        }
        if (row.product_code?.trim()) {
          csvCodesSet.add(row.product_code.trim());
        }
      });

      if (allErrors.length > 0) {
        result.errors = allErrors;
        result.failed = rows.length;
        return result;
      }

      // Process rows in batches
      const BATCH_SIZE = 50;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

      for (let i = 0; i < totalBatches; i++) {
        const batch = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const rowsToInsert: any[] = [];
        const rowsToUpdate: any[] = [];

        batch.forEach((row, batchIndex) => {
          const globalIndex = i * BATCH_SIZE + batchIndex;
          const productCode = row.product_code?.trim();
          const existingId = existingCodesMap.get(productCode);

          if (existingId) {
            if (mode === 'skip') {
              result.skipped++;
            } else if (mode === 'update') {
              const transformed = transformRow(row);
              rowsToUpdate.push({ ...transformed, id: existingId });
            } else if (mode === 'new-only') {
              result.skipped++;
            }
          } else {
            rowsToInsert.push(transformRow(row));
          }
        });

        // Insert new products
        if (rowsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('finished_goods')
            .insert(rowsToInsert);

          if (insertError) {
            result.failed += rowsToInsert.length;
            rowsToInsert.forEach((_, idx) => {
              result.errors.push({
                row: i * BATCH_SIZE + idx + 2,
                field: 'database',
                message: insertError.message
              });
            });
          } else {
            result.success += rowsToInsert.length;
          }
        }

        // Update existing products
        for (const row of rowsToUpdate) {
          const { error: updateError } = await supabase
            .from('finished_goods')
            .update(row)
            .eq('id', row.id);

          if (updateError) {
            result.failed++;
            result.errors.push({
              row: 0, // We'd need to track this better
              field: 'database',
              message: updateError.message
            });
          } else {
            result.success++;
          }
        }

        setProgress(Math.round(((i + 1) / totalBatches) * 100));
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods'] });
      setProgress(0);

      if (result.success > 0) {
        toast({
          title: 'Upload Complete',
          description: `Successfully imported ${result.success} product(s). ${result.skipped > 0 ? `Skipped ${result.skipped}.` : ''} ${result.failed > 0 ? `Failed ${result.failed}.` : ''}`,
        });
      }
    },
    onError: (error: Error) => {
      setProgress(0);
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    parseCSV,
    uploadMutation,
    progress,
  };
};

export const downloadCSVTemplate = () => {
  const headers = [
    'product_code',
    'product_name',
    'unit_of_measure',
    'style_no',
    'size',
    'color',
    'variant',
    'category',
    'description',
    'selling_price',
    'standard_cost',
    'minimum_stock',
    'maximum_stock',
    'reorder_point',
    'lead_time_days',
    'current_stock',
    'quality_status',
    'status',
    'product_master_code',
  ];

  const exampleRow = [
    'PROD001',
    'Sample T-Shirt',
    'pcs',
    'ST001',
    'M',
    'Blue',
    'Variant A',
    'Apparel',
    'Cotton T-Shirt',
    '29.99',
    '15.00',
    '10',
    '100',
    '20',
    '7',
    '50',
    'approved',
    'active',
    '',
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  XLSX.writeFile(workbook, 'finished_goods_template.csv');
};
