/* global ajaxurl */
var coauthorsSelector, coauthorsSortable;

( function( $ ) {
	var currentlyEditing, searchTimer, River, Query,
		inputs = {},
		rivers = {},
		isTouch = ( 'ontouchend' in document );

	coauthorsSortable = {
		list: $('#coauthors-select-list'),
		toggle: $('#coauthor-add-toggle'),

		currentAuthors: function() {
			var list = coauthorsSortable.list.find( 'li.coauthor-sortable' ).not( currentlyEditing );
			return _.map( list,
				function(li) {
					return _.first( $( li ).find( '[name="coauthors[]"]' ).val().split('|||') );
				}
			);
		},

		removeSortableLi: function(evt) {
			$(evt.currentTarget).closest('li.coauthor-sortable').remove();
		},

		openSelectorToEdit: function(evt) {
			var link = $(evt.currentTarget),
				thisLi = link.closest('li.coauthor-sortable'),
				thisAuthor = link.data( 'author-nicename' );

			currentlyEditing = thisLi;

			inputs.role.val( link.data('role') );
			inputs.authorNicename.val( link.data('author-nicename') );
			inputs.search.val( link.data('author-name') );

			coauthorsSelector.open( thisLi );

			inputs.search.trigger('keyup');
		},

		openSelectorForNewElement: function(evt) {
			currentlyEditing = false;
			coauthorsSelector.open( false );
			coauthorsSelector.refresh();
		},

		init: function() {
			this.list.sortable();
			this.list.on( 'click', 'a.remove-coauthor', this.removeSortableLi );
			this.list.on( 'click', 'a.edit-coauthor', this.openSelectorToEdit );
			this.toggle.on( 'click', this.openSelectorForNewElement );
		}
	};

	coauthorsSelector = {
		timeToTriggerRiver: 150,
		minRiverAJAXDuration: 200,
		riverBottomThreshold: 5,
		keySensitivity: 100,
		lastSearch: '',
		textarea: '',

		init: function() {
			inputs.wrap = $('#coauthor-select-wrap');
			inputs.dialog = $( '#coauthor-select' );
			inputs.backdrop = $( '#coauthor-select-backdrop' );
			inputs.submit = $( '#coauthor-select-submit' );
			inputs.close = $( '#coauthor-select-close' );
			inputs.header = $( '#coauthor-select-header' );

			// Inputs
			inputs.role = $( '#coauthor-select-role' );
			inputs.authorNicename = $( '#coauthor-author-nicename' );
			inputs.postId = $( '#coauthor-post-id' );
			inputs.nonce = $( '#_coauthor_select_nonce' );

			// Advanced Options
			inputs.search = $( '#coauthor-search-field' );

			// Build Rivers
			rivers.search = new River( $( '#search-results' ) );
			rivers.recent = new River( $( '#most-recent-results' ) );
			rivers.elements = inputs.dialog.find( '.query-results' );

			// Get search notice text
			inputs.queryNotice = $( '#query-notice-message' );
			inputs.queryNoticeTextDefault = inputs.queryNotice.find( '.query-notice-default' );
			inputs.queryNoticeTextHint = inputs.queryNotice.find( '.query-notice-hint' );

			// Bind event handlers
			inputs.dialog.keydown( coauthorsSelector.keydown );
			inputs.dialog.keyup( coauthorsSelector.keyup );
			inputs.submit.click( function( event ) {
				event.preventDefault();
				coauthorsSelector.update();
			});
			inputs.close.add( inputs.backdrop ).add( '#coauthor-select-cancel a' ).click( function( event ) {
				event.preventDefault();
				coauthorsSelector.close();
				currentlyEditing = false;
			});

			rivers.elements.on( 'coauthors-river-select', coauthorsSelector.updateFields );

			// Display 'hint' message when search field or 'query-results' box are focused
			inputs.search.on( 'focus.coauthors', function() {
				inputs.queryNoticeTextDefault.hide();
				inputs.queryNoticeTextHint.removeClass( 'screen-reader-text' ).show();
			} ).on( 'blur.coauthors', function() {
				inputs.queryNoticeTextDefault.show();
				inputs.queryNoticeTextHint.addClass( 'screen-reader-text' ).hide();
			} );

			inputs.search.keyup( function() {
				var self = this;

				window.clearTimeout( searchTimer );
				searchTimer = window.setTimeout( function() {
					coauthorsSelector.searchAuthors.call( self );
				}, 500 );
			});
		},

		open: function( currentlyEditing ) {
			$( document.body ).addClass( 'modal-open' );

			coauthorsSelector.range = null;

			inputs.header.text( function() {
				return currentlyEditing ?
					coauthorsL10n.editExistingAuthorHeader :
					coauthorsL10n.addNewAuthorHeader;
			});

			inputs.submit.attr( 'value',  function() {
				return currentlyEditing ?
					coauthorsL10n.editExistingAuthorButton :
					coauthorsL10n.addNewAuthorButton;
			});

			inputs.wrap.show();
			inputs.backdrop.show();

			coauthorsSelector.refresh();

			$( document ).trigger( 'coauthors-select-open', inputs.wrap );
		},

		refresh: function() {

			// Reset each of the inputs
			inputs.role.val();
			inputs.authorNicename.val();
			inputs.search.val();

			// Refresh rivers (clear links, check visibility)
			rivers.search.refresh();
			rivers.recent.refresh();

			if ( isTouch ) {
				// Close the onscreen keyboard
				inputs.search.focus().blur();
			} else {
				// Focus the URL field and highlight its contents.
				// If this is moved above the selection changes,
				// IE will show a flashing cursor over the dialog.
				inputs.search.focus()[0].select();
			}

			// Load the most recent results if this is the first time opening the panel.
			if ( ! rivers.recent.ul.children().length ) {
				rivers.recent.ajax();
			}
		},

		close: function() {
			$( document.body ).removeClass( 'modal-open' );

			inputs.backdrop.hide();
			inputs.wrap.hide();

			window.setTimeout(
				function() { coauthorsSelector.refresh(); }, 5000
			);

			$( document ).trigger( 'coauthor-select-close', inputs.wrap );
		},

		getAttrs: function() {
			return {
				role: inputs.role.val(),
				authorNicename: inputs.authorNicename.val()
			};
		},

		update: function() {
			// validate that an author ID is selected
			if ( ! inputs.authorNicename.val() ) {
				return false; // TODO: helpful error message
			}

			var query = {
					action: 'coauthor-sortable-template',
					authorNicename: inputs.authorNicename.val(),
					authorRole: inputs.role.val(),
					'_ajax_coauthor_template_nonce': inputs.nonce.val()
				};

			$.post( ajaxurl, query, function( r ) {
				if ( r.success ) {
					if ( currentlyEditing ) {
						currentlyEditing.html( r.data )
						currentlyEditing = false;
					} else {
						coauthorsSortable.list.append( r.data );
					}
				} else {
					coauthorsSortable.list.after( r.data );

				}

			});
			this.close();

		},

		updateFields: function( e, li ) {
			inputs.authorNicename.val( li.children( '.item-nicename' ).val() );
		},

		searchAuthors: function() {
			var t = $( this ), waiting,
				search = t.val();

			if ( search.length > 2 ) {
				rivers.recent.hide();
				rivers.search.show();

				// Don't search if the keypress didn't change the title.
				if ( coauthorsSelector.lastSearch == search ) {
					return;
				}

				coauthorsSelector.lastSearch = search;
				waiting = t.parent().find('.spinner').show();

				rivers.search.change( search );
				rivers.search.ajax( function() {
					waiting.hide();
				});
			} else {
				rivers.search.hide();
				rivers.recent.show();
			}
		},

		next: function() {
			rivers.search.next();
			rivers.recent.next();
		},

		prev: function() {
			rivers.search.prev();
			rivers.recent.prev();
		},

		keydown: function( event ) {
			var fn, id,
				key = $.ui.keyCode;

			if ( key.ESCAPE === event.keyCode ) {
				coauthorsSelector.close();
				event.stopImmediatePropagation();
			} else if ( key.TAB === event.keyCode ) {
				id = event.target.id;

				// coauthor-select-submit must always be the last focusable element in the dialog.
				// following focusable elements will be skipped on keyboard navigation.
				if ( id === 'coauthor-select-submit' && ! event.shiftKey ) {
					inputs.close.focus();
					event.preventDefault();
				} else if ( id === 'coauthor-select-close' && event.shiftKey ) {
					inputs.submit.focus();
					event.preventDefault();
				}
			}

			if ( event.keyCode !== key.UP && event.keyCode !== key.DOWN ) {
				return;
			}

			if ( document.activeElement &&
				( document.activeElement.id === 'link-title-field' || document.activeElement.id === 'url-field' ) ) {
				return;
			}

			fn = event.keyCode === key.UP ? 'prev' : 'next';
			clearInterval( coauthorsSelector.keyInterval );
			coauthorsSelector[ fn ]();
			coauthorsSelector.keyInterval = setInterval( coauthorsSelector[ fn ], coauthorsSelector.keySensitivity );
			event.preventDefault();
		},

		keyup: function( event ) {
			var key = $.ui.keyCode;

			if ( event.which === key.UP || event.which === key.DOWN ) {
				clearInterval( coauthorsSelector.keyInterval );
				event.preventDefault();
			}
		},

		delayedCallback: function( func, delay ) {
			var timeoutTriggered, funcTriggered, funcArgs, funcContext;

			if ( ! delay ) {
				return func;
			}

			setTimeout( function() {
				if ( funcTriggered ) {
					return func.apply( funcContext, funcArgs );
				}
				// Otherwise, wait.
				timeoutTriggered = true;
			}, delay );

			return function() {
				if ( timeoutTriggered ) {
					return func.apply( this, arguments );
				}
				// Otherwise, wait.
				funcArgs = arguments;
				funcContext = this;
				funcTriggered = true;
			};
		}

	};

	River = function( element, search ) {
		var self = this;
		this.element = element;
		this.ul = element.children( 'ul' );
		this.contentHeight = element.children( '#link-selector-height' );
		this.waiting = element.find('.river-waiting');

		this.change( search );
		this.refresh();

		$( '#coauthor-select .query-results, #coauthor-select #link-selector' ).scroll( function() {
			self.maybeLoad();
		});
		element.on( 'click', 'li', function( event ) {
			self.select( $( this ), event );
		});
	};

	$.extend( River.prototype, {
		refresh: function() {
			this.deselect();
			this.visible = this.element.is( ':visible' );
		},
		show: function() {
			if ( ! this.visible ) {
				this.deselect();
				this.element.show();
				this.visible = true;
			}
		},
		hide: function() {
			this.element.hide();
			this.visible = false;
		},
		// Selects a list item and triggers the river-select event.
		select: function( li, event ) {
			var liHeight, elHeight, liTop, elTop;

			if ( li.hasClass( 'unselectable' ) || li == this.selected ) {
				return;
			}

			this.deselect();
			this.selected = li.addClass( 'selected' );
			// Make sure the element is visible
			liHeight = li.outerHeight();
			elHeight = this.element.height();
			liTop = li.position().top;
			elTop = this.element.scrollTop();

			if ( liTop < 0 ) // Make first visible element
				this.element.scrollTop( elTop + liTop );
			else if ( liTop + liHeight > elHeight ) // Make last visible element
				this.element.scrollTop( elTop + liTop - elHeight + liHeight );

			// Trigger the river-select event
			this.element.trigger( 'coauthors-river-select', [ li, event, this ] );
		},
		deselect: function() {
			if ( this.selected ) {
				this.selected.removeClass( 'selected' );
			}
			this.selected = false;
		},
		prev: function() {
			if ( ! this.visible ) {
				return;
			}

			var to;
			if ( this.selected ) {
				to = this.selected.prev( 'li' );
				if ( to.length ) {
					this.select( to );
				}
			}
		},
		next: function() {
			if ( ! this.visible ) {
				return;
			}

			var to = this.selected ? this.selected.next( 'li' ) : $( 'li:not(.unselectable):first', this.element );
			if ( to.length ) {
				this.select( to );
			}
		},
		ajax: function( callback ) {
			var self = this,
				delay = this.query.page == 1 ? 0 : coauthorsSelector.minRiverAJAXDuration,
				response = coauthorsSelector.delayedCallback( function( results, params ) {
					self.process( results, params );
					if ( callback ) {
						callback( results, params );
					}
				}, delay );

			this.query.ajax( response );
		},
		change: function( search ) {
			if ( this.query && this._search == search ) {
				return;
			}

			this._search = search;
			this.query = new Query( search );
			this.element.scrollTop( 0 );
		},
		process: function( results, params ) {
			var alt = true, classes = '',
				elt = this.ul,
				firstPage = params.page === 1;

			if ( firstPage ) {
				elt.html('');
			}

			if ( typeof results.success === 'undefined' || ! results.success ) {
				if ( firstPage ) {
					var newLi = $( '<li></li>' ).attr( 'class', 'unselectable no-matches-found' )
						.append( $( '<span></span>' ).attr( 'class', 'item-title' )
							.append( $( '<em></em>' ).text( coauthorsL10n.noMatchesFound ) )
						);
					elt.html( newLi );
				}
			} else {
				$.each( results.data, function() {
					classes = alt ? 'alternate' : '';
					classes += this.post_title ? '' : ' no-title';

					var newLi = $( '<li></li>').attr( 'class', classes )
						.append( $( '<input />'  )
							.attr({
								'type': 'hidden',
								'class': 'item-nicename'
							})
							.val( this.user_nicename )
						)
						.append( $( '<span></span>')
							.attr({
								'class': 'item-title'
							})
							.text( this.display_name ? this.display_name : coauthorsL10n.noTitle )
						)
						.append(
							$('<span></span>')
							.attr({
								'class': 'item-info'
							})
							.text( this.type.replace('-',' ') )
						);

					elt.append( newLi );
					alt = ! alt;
				});
			}
		},
		maybeLoad: function() {
			var self = this,
				el = this.element,
				bottom = el.scrollTop() + el.height();

			if ( ! this.query.ready() || bottom < this.contentHeight.height() - coauthorsSelector.riverBottomThreshold ) {
				return;
			}

			setTimeout(function() {
				var newTop = el.scrollTop(),
					newBottom = newTop + el.height();

				if ( ! self.query.ready() || newBottom < self.contentHeight.height() - coauthorsSelector.riverBottomThreshold ) {
					return;
				}

				self.waiting.show();
				el.scrollTop( newTop + self.waiting.outerHeight() );

				self.ajax( function() {
					self.waiting.hide();
				});
			}, coauthorsSelector.timeToTriggerRiver );
		}
	});

	Query = function( search ) {
		this.page = 1;
		this.allLoaded = false;
		this.querying = false;
		this.search = search;
	};

	$.extend( Query.prototype, {
		ready: function() {
			return ! ( this.querying || this.allLoaded );
		},
		ajax: function( callback ) {
			var self = this,
				query = {
					action : 'coauthor-select-ajax',
					page : this.page,
					exclude: coauthorsSortable.currentAuthors(),
					'_ajax_coauthor_search_nonce' : inputs.nonce.val()
				};

			if ( this.search ) {
				query.search = this.search;
			}

			this.querying = true;

			$.post( ajaxurl, query, function( r ) {
				self.page++;
				self.querying = false;
				self.allLoaded = ! r.success;
				callback( r, query );
			}, 'json' );
		}
	});

	$( document ).ready( function() {
		coauthorsSelector.init();
		coauthorsSortable.init();
	});

})( jQuery );
