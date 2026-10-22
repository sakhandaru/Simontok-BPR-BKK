import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type SimPaginationLink = { url: string | null; label: string; active: boolean };

export function SimPagination({ links }: { links: SimPaginationLink[] }) {
    if (links.length < 4) return null;

    const previous = links[0];
    const next = links[links.length - 1];
    const pages = links.slice(1, -1).filter((link) => !link.label.includes('...'));

    return (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
            <Link href={previous.url ?? '#'} preserveScroll className="inline-flex size-9 items-center justify-center border border-border text-muted-foreground transition hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-40" aria-disabled={!previous.url}>
                <ChevronLeft className="size-4" />
                <span className="sr-only">Halaman sebelumnya</span>
            </Link>
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                {pages.map((link, index) => link.url ? (
                    <Link key={`${link.label}-${index}`} href={link.url} preserveScroll className={`inline-flex size-9 shrink-0 items-center justify-center border text-sm ${link.active ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted'}`} aria-current={link.active ? 'page' : undefined}>
                        {link.label}
                    </Link>
                ) : <span key={`${link.label}-${index}`} className="px-1 text-muted-foreground">...</span>)}
            </div>
            <Link href={next.url ?? '#'} preserveScroll className="inline-flex size-9 items-center justify-center border border-border text-muted-foreground transition hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-40" aria-disabled={!next.url}>
                <ChevronRight className="size-4" />
                <span className="sr-only">Halaman berikutnya</span>
            </Link>
        </nav>
    );
}
