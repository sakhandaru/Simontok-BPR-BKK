import { Head, Link } from '@inertiajs/react';
import { login } from '@/routes';

export default function Register() {
    return (
        <>
            <Head title="Registrasi dinonaktifkan" />
            <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">Pembuatan akun dilakukan oleh administrator aplikasi.</p>
                <Link className="text-sm font-medium underline underline-offset-4" href={login()}>Kembali ke login</Link>
            </div>
        </>
    );
}
