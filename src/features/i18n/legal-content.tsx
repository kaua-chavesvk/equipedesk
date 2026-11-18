import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { translator, type Locale } from './translate';

// The accepted Portuguese documents keep their versioned source and digests.
// Translate their static element trees on the server, before sending any HTML.
export function translateLegalContent(content: ReactNode, locale: Locale): ReactNode {
  if (locale === 'pt-BR') return content;
  const t = translator(locale);
  return Children.map(content, (child) => {
    if (typeof child === 'string') return t(child);
    if (!isValidElement<{ children?: ReactNode }>(child)) return child;
    return cloneElement(child, {}, translateLegalContent(child.props.children, locale));
  });
}
