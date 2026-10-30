import { useEffect, useState } from 'react';
import { ExternalLink, Megaphone } from 'lucide-react';
import { router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Announcement = {
    id: number;
    title: string;
    body: string;
    link_url?: string | null;
    image_url?: string | null;
    priority: 'normal' | 'important';
    published_at?: string | null;
    created_by: string;
};

export function AnnouncementModal() {
    const { announcements = [] } = usePage<{ announcements?: Announcement[] }>().props;
    const [queue, setQueue] = useState<Announcement[]>(announcements);
    const [open, setOpen] = useState(announcements.length > 0);
    const current = queue[0];

    useEffect(() => {
        if (announcements.length > 0) {
            setQueue(announcements);
            setOpen(true);
        }
    }, [announcements]);

    const acknowledge = () => {
        if (!current) return;

        router.post(`/announcements/${current.id}/read`, {}, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setQueue((items) => items.slice(1));
                setOpen(queue.length > 1);
            },
        });
    };

    if (!current) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Megaphone className="size-4" />
                        Siaran operasional
                        {current.priority === 'important' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">Penting</span>}
                    </div>
                    <DialogTitle>{current.title}</DialogTitle>
                    <DialogDescription>
                        Disampaikan oleh {current.created_by}{current.published_at ? ` · ${current.published_at}` : ''}
                    </DialogDescription>
                </DialogHeader>
                {current.image_url && <img src={current.image_url} alt="" className="max-h-72 w-full rounded-md border object-contain" />}
                <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{current.body}</div>
                {current.link_url && <a href={current.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4">Buka tautan <ExternalLink className="size-3.5" /></a>}
                <DialogFooter>
                    <Button type="button" onClick={acknowledge}>Saya sudah membaca</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
