export type Option = {
    id: number;
    code?: string;
    name: string;
};

export type OrderListItem = {
    id: number;
    order_no: string;
    customer_name: string;
    no_rekening: string;
    status: string;
    branch: string | null;
    notary: string | null;
    created_at: string | null;
};

export type Paginated<T> = {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
};
