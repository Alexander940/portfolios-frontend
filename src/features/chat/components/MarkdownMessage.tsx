import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders the assistant's streamed markdown answer. GFM enables tables,
 * which the assistant uses for comparisons and screener results. Styling
 * comes from `.msg-md` rules in chat.css.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="msg-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
