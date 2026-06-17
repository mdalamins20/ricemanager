
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';

export const ViewReport: React.FC = () => {
    const [searchParams] = useSearchParams();
    const reportId = searchParams.get('id');
    const [base64Data, setBase64Data] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!reportId) {
            setError("Invalid Report Link");
            setLoading(false);
            return;
        }

        const fetchReport = async () => {
            try {
                const doc = await db.collection('shared_reports').doc(reportId).get();
                if (doc.exists) {
                    const data = doc.data();
                    setBase64Data(data?.pdfBase64 || null);
                    setMetadata(data);
                } else {
                    setError("Report not found or has expired.");
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load report. Check your connection.");
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [reportId]);

    useEffect(() => {
        if (base64Data && metadata) {
            handleDownload();
        }
    }, [base64Data, metadata]);

    const handleDownload = () => {
        if (!base64Data) return;
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${base64Data}`;
        link.download = `Report_${metadata?.memberName || 'Download'}_${metadata?.month || ''}.pdf`;
        link.click();
    };

    if (loading) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
                <p className="text-slate-500 font-bold animate-pulse">Loading Your Report...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full">
                    <AlertCircle className="h-12 w-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Oops!</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-xs">{error}</p>
                <button 
                    onClick={() => window.location.href = '#/'} 
                    className="px-6 py-3 bg-slate-800 text-white rounded-2xl font-bold transition-all active:scale-95"
                >
                    Back to Home
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-full animate-bounce">
                        <Download className="h-10 w-10 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Your download has started!</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                            {metadata?.memberName}'s report for <strong>{metadata?.month}</strong> is being downloaded.
                        </p>
                    </div>
                    
                    <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-2" />

                    <div className="space-y-4 w-full">
                        <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Didn't start? Click below</p>
                        <button 
                            onClick={handleDownload}
                            className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 dark:shadow-none transition-all active:scale-95"
                        >
                            <Download className="h-5 w-5" /> Download PDF Manually
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop Preview (Only if user wants to see it) */}
            <div className="hidden md:block">
                <p className="text-center text-slate-400 text-xs font-bold uppercase mb-4 tracking-widest">Document Preview</p>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 min-h-[600px]">
                    <iframe 
                        src={`data:application/pdf;base64,${base64Data}#toolbar=0`} 
                        className="w-full h-[600px]"
                        title="Report Preview"
                    />
                </div>
            </div>
        </div>
    );
};
