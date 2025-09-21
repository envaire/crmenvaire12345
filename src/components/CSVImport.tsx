import React, { useState } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CSVImportProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  errors: string[];
}

const CSVImport: React.FC<CSVImportProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      
      // Extract industry from filename
      const filename = selectedFile.name.replace('.csv', '');
      setIndustry(filename);
      
      // Preview first few rows
      const reader = new FileReader();
      reader.onload = (event) => {
        const csv = event.target?.result as string;
        const lines = csv.split('\n').slice(0, 4); // First 3 data rows + header
        const previewData = lines.map(line => {
          const values = line.split(',');
          return {
            firm: values[0] || '',
            revenue: values[1] || '',
            website: values[2] || '',
            phone: values[4] || '',
            ceo: values[6] || '',
            called: values[7] || '',
            status: values[10] || ''
          };
        });
        setPreview(previewData.slice(1)); // Remove header
      };
      reader.readAsText(selectedFile);
    }
  };

  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(',');
        return {
          firm: values[0]?.trim() || '',
          revenue: values[1]?.trim() || '',
          website: values[2]?.trim() || '',
          go_skip: values[3]?.trim() || '',
          phone: values[4]?.trim() || '',
          whose_phone: values[5]?.trim() || '',
          ceo: values[6]?.trim() || '',
          called: values[7]?.trim() || '',
          last_contact: values[8]?.trim() || '',
          notes: values[9]?.trim() || '',
          status: values[10]?.trim() || ''
        };
      })
      .filter(row => row.firm); // Only rows with company names
  };

  const mapCallStatus = (called: string): string => {
    const callLower = called.toLowerCase();
    if (callLower.includes('answered')) return 'answered';
    if (callLower.includes('no response')) return 'no_response';
    if (callLower.includes('voicemail')) return 'voicemail';
    if (callLower.includes('busy')) return 'busy';
    if (callLower.includes('wrong') || callLower.includes('not in use')) return 'wrong_number';
    return 'not_called';
  };

  const mapStatus = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('lost')) return 'closed-lost';
    if (statusLower.includes('booked') || statusLower.includes('meeting')) return 'qualified';
    if (statusLower.includes('later')) return 'proposal';
    return 'prospect';
  };

  const handleImport = async () => {
    if (!file || !user) return;

    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const csvText = event.target?.result as string;
        const rows = parseCSV(csvText);
        
        let imported = 0;
        let duplicates = 0;
        const errors: string[] = [];

        // Check for existing companies to prevent duplicates
        const { data: existingLeads } = await supabase
          .from('leads')
          .select('company')
          .eq('user_id', user.id);

        const existingCompanies = new Set(
          existingLeads?.map(lead => lead.company.toLowerCase()) || []
        );

        for (const row of rows) {
          try {
            // Skip if company already exists
            if (existingCompanies.has(row.firm.toLowerCase())) {
              duplicates++;
              continue;
            }

            const leadData = {
              user_id: user.id,
              name: row.firm,
              company: row.firm,
              email: '', // Not in CSV
              phone: row.phone,
              position: row.whose_phone || '',
              status: mapStatus(row.status),
              call_status: mapCallStatus(row.called),
              industry: industry,
              value: 0,
              notes: row.notes,
              website: row.website,
              revenue: row.revenue,
              ceo: row.ceo,
              whose_phone: row.whose_phone,
              go_skip: row.go_skip,
              last_contact: row.last_contact ? new Date(row.last_contact + ' 2024').toISOString() : new Date().toISOString()
            };

            const { error } = await supabase
              .from('leads')
              .insert([leadData]);

            if (error) {
              errors.push(`${row.firm}: ${error.message}`);
            } else {
              imported++;
              existingCompanies.add(row.firm.toLowerCase());
            }
          } catch (err) {
            errors.push(`${row.firm}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }

        setResult({ imported, duplicates, errors });
        if (imported > 0) {
          onSuccess();
        }
      } catch (err) {
        setResult({
          imported: 0,
          duplicates: 0,
          errors: ['Failed to parse CSV file']
        });
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="absolute inset-0 data-grid"></div>
      <div className="relative tech-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto glow-green">
        <div className="flex items-center justify-between p-6 border-b border-green-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-900 rounded-lg flex items-center justify-center glow-green">
              <Upload className="w-4 h-4 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-green-300">Import Leads from CSV</h2>
          </div>
          <button
            onClick={onClose}
            className="text-green-400 hover:text-green-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!result ? (
            <>
              <div className="border-2 border-dashed border-green-500 rounded-lg p-8 text-center tech-card">
                <FileText className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-lg font-medium text-green-300">
                    Upload your Google Sheets CSV file
                  </p>
                  <p className="text-sm text-green-400">
                    The filename will be used as the industry category
                  </p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="mt-4 block w-full text-sm text-green-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-900 file:bg-opacity-30 file:text-green-300 hover:file:bg-green-800 hover:file:bg-opacity-30"
                />
              </div>

              {file && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-green-300 mb-2">
                      Industry Category
                    </label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
                      placeholder="e.g., HENKILÖSTÖVUOKRAUS"
                    />
                  </div>

                  {preview.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-green-300 mb-2">Preview (first 3 rows):</h3>
                      <div className="tech-card rounded-lg p-4 overflow-x-auto border border-green-800">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="text-green-400">
                              <th className="text-left p-1">Company</th>
                              <th className="text-left p-1">Revenue</th>
                              <th className="text-left p-1">Phone</th>
                              <th className="text-left p-1">CEO</th>
                              <th className="text-left p-1">Called</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.map((row, i) => (
                              <tr key={i} className="text-green-300">
                                <td className="p-1 font-medium">{row.firm}</td>
                                <td className="p-1">{row.revenue}</td>
                                <td className="p-1">{row.phone}</td>
                                <td className="p-1">{row.ceo}</td>
                                <td className="p-1">{row.called}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="tech-card border border-green-500 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-green-400 mt-0.5" />
                      <div className="text-sm text-green-300">
                        <p className="font-medium mb-1 text-green-300">Import Notes:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• Duplicate companies will be skipped automatically</li>
                          <li>• Call status will be mapped from the "Called" column</li>
                          <li>• Lead status will be inferred from the "Status" column</li>
                          <li>• Missing information is okay - all available data will be imported</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleImport}
                    disabled={loading || !industry.trim()}
                    className="w-full tech-button text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Import Leads</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-300 mb-2">Import Complete!</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="tech-card border border-green-500 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-300">{result.imported}</div>
                  <div className="text-sm text-green-400">Leads Imported</div>
                </div>
                <div className="tech-card border border-yellow-500 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-300">{result.duplicates}</div>
                  <div className="text-sm text-yellow-400">Duplicates Skipped</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="tech-card border border-red-500 rounded-lg p-4">
                  <h4 className="font-medium text-red-300 mb-2">Errors ({result.errors.length}):</h4>
                  <div className="max-h-32 overflow-y-auto">
                    {result.errors.map((error, i) => (
                      <p key={i} className="text-xs text-red-400">{error}</p>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full tech-button text-white py-2 px-4 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSVImport;