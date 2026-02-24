'use client';
import { DocumentStatusBadge } from './status-badge';
import { Button } from './ui/button';

interface Document {
  id: string;
  docType?: string;
  status: string;
  version?: number;
  createdAt?: string;
  url?: string;
}

interface DocumentListProps {
  documents: Document[];
  onDownload?: (doc: Document) => void;
  onRefresh?: () => void | Promise<void>;
}

export function DocumentList({ documents, onDownload }: DocumentListProps) {
  if (!documents.length) return <p className="text-muted-foreground text-sm">No documents yet.</p>;
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b-2 border-border">
          {['Type', 'Version', 'Status', 'Date', ''].map((h, i) => (
            <th key={i} className="text-left px-3 py-2 text-muted-foreground font-semibold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {documents.map(doc => (
          <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
            <td className="px-3 py-2.5 text-foreground font-medium">{doc.docType ?? 'LAB_REPORT'}</td>
            <td className="px-3 py-2.5 text-muted-foreground">v{doc.version ?? 1}</td>
            <td className="px-3 py-2.5"><DocumentStatusBadge status={doc.status} /></td>
            <td className="px-3 py-2.5 text-muted-foreground">{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '—'}</td>
            <td className="px-3 py-2.5">
              {doc.url && onDownload && (
                <Button size="sm" variant="outline" onClick={() => onDownload(doc)}>
                  Download
                </Button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default DocumentList;
