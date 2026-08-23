import React from 'react';

// http(s) links and bare www. addresses - people paste both, so both need to
// come out clickable.
const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const IS_URL = /^(?:https?:\/\/|www\.)/i;
// Punctuation at the very end usually belongs to the sentence, not the address.
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/**
 * Component that renders text with clickable links.
 * Detects http/https URLs and www. addresses and wraps them in <a> tags.
 */
export default function LinkifiedText({ text }) {
    if (!text) return null;

    const parts = String(text).split(URL_REGEX);

    return (
        <>
            {parts.map((part, i) => {
                if (!IS_URL.test(part)) return part;

                let url = part;
                let trailing = '';

                // A closing bracket only belongs to the URL if it opened inside it,
                // otherwise it closes something the author wrote around the link.
                while (url.endsWith(')') && !url.includes('(')) {
                    trailing = ')' + trailing;
                    url = url.slice(0, -1);
                }

                const punctuation = url.match(TRAILING_PUNCTUATION)?.[0];
                if (punctuation) {
                    trailing = punctuation + trailing;
                    url = url.slice(0, -punctuation.length);
                }

                const href = url.toLowerCase().startsWith('www.') ? `https://${url}` : url;

                return (
                    <React.Fragment key={i}>
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()} // Prevent parent click actions
                            style={{
                                textDecoration: 'underline',
                                color: 'var(--info-text)',
                                wordBreak: 'break-all'
                            }}
                        >
                            {url}
                        </a>
                        {trailing}
                    </React.Fragment>
                );
            })}
        </>
    );
}
