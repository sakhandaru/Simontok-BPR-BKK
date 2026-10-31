import type { ReactNode } from 'react';

export function SimPageHeader({ title, description, eyebrow, actions }: { title: string; description?: string; eyebrow?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="flex flex-col gap-4 pb-5 md:flex-row md:items-end md:justify-between">
            <div className="sim-page-header">
                {eyebrow && <div className="w-fit max-w-full">{eyebrow}</div>}
                <h1 className="sim-page-title">{title}</h1>
                {description && <p className="sim-page-description">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    );
}
