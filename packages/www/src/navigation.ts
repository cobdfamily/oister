import $ from 'jquery';

export class CBNavigation {

ui = $

constructor() {

if( document.readyState !== "loading" )
{
this.init();
}
else
{
$( this.init );
}

window.addEventListener( 'CBNavigateTo', this.navigateTo );
};

init = () => {

this.ui( '.main' ).show();

let accessibilityButton = document.querySelector( '#accessibility' );
let homeButton = document.querySelector( '#home' );
let helpButton = document.querySelector( '#help' );


if( accessibilityButton )
{
accessibilityButton.addEventListener( 'click', ( event ) => {
this.alert();
} );

}

if( homeButton )
{
homeButton.addEventListener( 'click', ( event ) => {
this.showMenu();
} );

}

if( helpButton )
{
helpButton.addEventListener( 'click', ( event ) => {
this.alert();
} );

}

};

isMobile = () => {

let body = this.ui( 'body' );

if( body && body.width() && ( body.width() < 801 ) )
{
return true;
}
return false;

};

goToURL = ( url: String ) => {

if( ( url != '' ) && ( url != this.ui( '#mainview' ).attr( 'src' ) ) )
{
this.ui( '#mainview' ).attr( 'src', url );
this.ui( '#mainview' ).attr( 'allow', 'geolocation' );
}

if( this.isMobile() )
{
this.ui( '#menu' ).hide();
this.ui( '.main' ).show();
}

this.ui( '#mainview' ).focus();

};

showMenu = () => {
this.ui( '.main' ).hide();
this.ui( '#menu' ).show();
};

navigateTo = ( event: CustomEvent ) => {

if( event.detail.url && ( event.detail.url == "menu" ) )
{
this.showMenu();
}
else
{
this.goToURL( event.detail.url );
}

};

alert() {
alert( 'Help information is not yet available for this item' );

};

};
