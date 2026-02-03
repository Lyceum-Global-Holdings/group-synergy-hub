import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

export interface ParsedStatementLine {
  line_number: number;
  transaction_date: string;
  value_date?: string;
  description: string;
  reference?: string;
  debit_amount?: number;
  credit_amount?: number;
  running_balance?: number;
}

export interface ColumnMapping {
  date: string;
  description: string;
  debit: string;
  credit: string;
  reference?: string;
  balance?: string;
}

const DEFAULT_COLUMN_PATTERNS = {
  date: ['date', 'transaction_date', 'value_date', 'trans_date', 'posting_date'],
  description: ['description', 'narrative', 'particulars', 'memo', 'details', 'transaction_description'],
  debit: ['debit', 'withdrawal', 'dr', 'debit_amount', 'withdrawals'],
  credit: ['credit', 'deposit', 'cr', 'credit_amount', 'deposits'],
  reference: ['reference', 'ref', 'check_no', 'cheque', 'check', 'transaction_ref'],
  balance: ['balance', 'running_balance', 'closing_balance'],
};

function autoDetectColumn(headers: string[], patterns: string[]): string | undefined {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
  for (const pattern of patterns) {
    const index = normalizedHeaders.findIndex(h => h.includes(pattern) || pattern.includes(h));
    if (index !== -1) return headers[index];
  }
  return undefined;
}

function parseAmount(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : Math.abs(num);
}

function parseDate(value: string): string {
  // Try various date formats
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  // Try DD/MM/YYYY format
  const parts = value.split(/[/-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const parsed = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  return value;
}

export function useBankStatementImport(bankAccountId: string) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    debit: '',
    credit: '',
  });
  const [parsedLines, setParsedLines] = useState<ParsedStatementLine[]>([]);
  const [fileName, setFileName] = useState('');

  const parseCSV = useCallback((text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  }, []);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);
      
      if (data.length < 2) {
        toast.error('File must have at least a header row and one data row');
        return;
      }
      
      const headerRow = data[0];
      setHeaders(headerRow);
      setRawData(data.slice(1));
      
      // Auto-detect column mapping
      const mapping: ColumnMapping = {
        date: autoDetectColumn(headerRow, DEFAULT_COLUMN_PATTERNS.date) || '',
        description: autoDetectColumn(headerRow, DEFAULT_COLUMN_PATTERNS.description) || '',
        debit: autoDetectColumn(headerRow, DEFAULT_COLUMN_PATTERNS.debit) || '',
        credit: autoDetectColumn(headerRow, DEFAULT_COLUMN_PATTERNS.credit) || '',
        reference: autoDetectColumn(headerRow, DEFAULT_COLUMN_PATTERNS.reference),
        balance: autoDetectColumn(headerRow, DEFAULT_COLUMN_PATTERNS.balance),
      };
      setColumnMapping(mapping);
      
      toast.success(`Loaded ${data.length - 1} rows from ${file.name}`);
    };
    
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    
    reader.readAsText(file);
  }, [parseCSV]);

  const applyMapping = useCallback(() => {
    if (!columnMapping.date || !columnMapping.description) {
      toast.error('Date and Description columns are required');
      return;
    }
    
    const headerIndexes: Record<string, number> = {};
    headers.forEach((h, i) => { headerIndexes[h] = i; });
    
    const lines: ParsedStatementLine[] = rawData.map((row, index) => {
      const getValue = (col: string | undefined) => col ? row[headerIndexes[col]] : undefined;
      
      return {
        line_number: index + 1,
        transaction_date: parseDate(getValue(columnMapping.date) || ''),
        description: getValue(columnMapping.description) || '',
        reference: getValue(columnMapping.reference),
        debit_amount: parseAmount(getValue(columnMapping.debit)),
        credit_amount: parseAmount(getValue(columnMapping.credit)),
        running_balance: parseAmount(getValue(columnMapping.balance)),
      };
    }).filter(line => line.transaction_date && line.description);
    
    setParsedLines(lines);
    toast.success(`Parsed ${lines.length} valid transactions`);
  }, [rawData, headers, columnMapping]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id || !bankAccountId || parsedLines.length === 0) {
        throw new Error('Missing required data for import');
      }

      // Calculate totals
      const totalDebits = parsedLines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
      const totalCredits = parsedLines.reduce((sum, l) => sum + (l.credit_amount || 0), 0);
      const periodStart = parsedLines.reduce((min, l) => l.transaction_date < min ? l.transaction_date : min, parsedLines[0].transaction_date);
      const periodEnd = parsedLines.reduce((max, l) => l.transaction_date > max ? l.transaction_date : max, parsedLines[0].transaction_date);

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('bank_statement_imports')
        .insert({
          bank_account_id: bankAccountId,
          company_id: selectedCompany.id,
          file_name: fileName,
          file_format: 'csv',
          transaction_count: parsedLines.length,
          total_debits: totalDebits,
          total_credits: totalCredits,
          period_start: periodStart,
          period_end: periodEnd,
          status: 'pending',
        })
        .select()
        .single();

      if (importError) throw importError;

      // Insert statement lines
      const lines = parsedLines.map(line => ({
        import_id: importRecord.id,
        line_number: line.line_number,
        transaction_date: line.transaction_date,
        description: line.description,
        reference: line.reference,
        debit_amount: line.debit_amount,
        credit_amount: line.credit_amount,
        running_balance: line.running_balance,
        match_status: 'unmatched',
      }));

      const { error: linesError } = await supabase
        .from('bank_statement_lines')
        .insert(lines);

      if (linesError) throw linesError;

      // Update import status
      await supabase
        .from('bank_statement_imports')
        .update({ status: 'imported' })
        .eq('id', importRecord.id);

      return importRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bank-statement-imports'] });
      queryClient.invalidateQueries({ queryKey: ['bank-statement-lines'] });
      toast.success(`Imported ${parsedLines.length} transactions`);
      // Reset state
      setRawData([]);
      setHeaders([]);
      setParsedLines([]);
      setFileName('');
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const reset = useCallback(() => {
    setRawData([]);
    setHeaders([]);
    setColumnMapping({ date: '', description: '', debit: '', credit: '' });
    setParsedLines([]);
    setFileName('');
  }, []);

  return {
    // State
    headers,
    rawData,
    columnMapping,
    parsedLines,
    fileName,
    isImporting: importMutation.isPending,
    
    // Actions
    processFile,
    setColumnMapping,
    applyMapping,
    importStatement: importMutation.mutate,
    reset,
  };
}
