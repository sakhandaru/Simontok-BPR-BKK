import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SimPaginationLink = { url: string | null; label: string; active: boolean };

export function SimPagination({ links }: { links: SimPaginationLink[] }) {
    if (links.length < 4) return null;

    return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-end gap-2">
        {links.map((link, index) => (
            <Button
                key={`${link.label}-${index}`}
                size={index === 0 || index === links.length - 1 ? 'icon' : 'sm'}
                variant={link.active ? 'default' : index === 0 || index === links.length - 1 ? 'ghost' : 'outline'}
                className={link.active ? 'bg-primary text-primary-foreground hover:bg-primary/90' : index === 0 || index === links.length - 1 ? 'px-1 text-muted-foreground hover:bg-muted hover:text-foreground' : 'border-border bg-background text-foreground hover:bg-muted'}
                disabled={!link.url}
                asChild={Boolean(link.url)}
            >
                {link.url ? <Link href={link.url} preserveState preserveScroll aria-label={index === 0 ? 'Halaman sebelumnya' : index === links.length - 1 ? 'Halaman berikutnya' : `Halaman ${link.label}`}>
                    {index === 0 ? <ChevronLeft className="size-4" /> : index === links.length - 1 ? <ChevronRight className="size-4" /> : link.label}
                </Link> : <span aria-label={index === 0 ? 'Halaman sebelumnya' : 'Halaman berikutnya'}>{index === 0 ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}</span>}
            </Button>
        ))}
    </nav>;
}
