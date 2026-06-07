// Shell styling: CLF design tokens + the shell's own layout.
// Imported here so Vite bundles them — no more sync-clf-tokens step.
import '@cobdfamily/clf-core/tokens.css';
import './shell.css';

import { CBNavigation } from './navigation.js';

declare global {
    interface Window { sendEvent: any; }
    interface WindowEventMap {
        'CBNavigateTo': CustomEvent;
    }
}

// Setup bridges
window.addEventListener( 'message', ( event ) => {
window.dispatchEvent( new CustomEvent( event.data.name, { detail: event.data.detail } ) );
} );

window.sendEvent = ( name: String, detail: any ) => {
let mainView = document.querySelector<HTMLIFrameElement>( '#mainview' );

if( mainView && ( mainView.contentWindow ) )
{
mainView.contentWindow.postMessage( { name: name, detail: detail }, '*' );
}
};

let navigation = new CBNavigation();
