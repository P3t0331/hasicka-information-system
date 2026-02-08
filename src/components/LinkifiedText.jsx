import React from 'react';

/**
 * Component that renders text with clickable links.
 * Detects http/https URLs and wraps them in <a> tags.
 */
export default function LinkifiedText({ text }) {
    if (!text) return null;

    // Regex to find URLs (starting with http:// or https://)
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    const parts = text.split(urlRegex);

    return (
        <>
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()} // Prevent parent click actions
                            style={{
                                textDecoration: 'underline',
                                color: 'inherit', // Keep parent color (usually inherited from description)
                                wordBreak: 'break-all'
                            }}
                        >
                            {part}
                        </a>
                    );
                }
                return part;
            })}
        </>
    );
}
