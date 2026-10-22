import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 40 42" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3.5h17l7 7v28H8v-35Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M25 3.5v8h7M13 18h14M13 23h14M13 28h8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path d="m23 28 3.2 3.2L33 24.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
