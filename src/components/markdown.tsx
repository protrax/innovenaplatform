import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-lg",
        "prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-base",
        "prose-p:my-3 prose-p:leading-relaxed",
        "prose-ul:my-3 prose-li:my-1",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "text-foreground",
        className,
      )}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h2 className="mt-6 mb-3 text-xl font-semibold">{children}</h2>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-3 text-lg font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="my-3 leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="my-1">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-brand underline underline-offset-2 hover:text-brand/80"
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
