import { Component, createElement, PropTypes } from 'react';
import shallowCompare from 'react-addons-shallow-compare';
import hoistStatics from 'hoist-non-react-statics';
import uuid from 'uuid';
import $ from 'npm-zepto';

/* eslint-disable no-unused-vars */
const { debug } = require('tools/log')('styleInjector');
/* eslint-enable no-unused-vars */


const stylesheets = new Map();


function getDisplayName(WrappedComponent) {
	return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

function hasDisplayName(WrappedComponent) {
	return Boolean(WrappedComponent.displayName || WrappedComponent.name);
}

function injectStyles(WrappedComponent, template, styles, theme, options) {
	const stylesheetComponentIdKey = uuid();
	let stylesheetID;

	if (hasDisplayName(WrappedComponent)) {
		stylesheetID = `stylesheet-${getDisplayName(WrappedComponent)}`;
	} else {
		stylesheetID = `stylesheet-${uuid()}`;
	}

	if (!theme) {
		return {
			id: stylesheetID,
			componentIdKey: stylesheetComponentIdKey,
		};
	}

	if (typeof window !== 'undefined') {
		const currentStylesheetKeyList = stylesheets.get(stylesheetID);
		if (!Array.isArray(currentStylesheetKeyList) || !currentStylesheetKeyList.length) {
			if ($(`[data-cssorid=${stylesheetID}]`).length !== 0) {
				$(`[data-cssorid=${stylesheetID}]`).remove();
			}

			debug(`wrapping ${getDisplayName(WrappedComponent)}, theme:`, styles(theme), stylesheets);

			const stylesheet = template(styles(theme));
			const sheet = $(`<style data-cssorid=${stylesheetID}>${stylesheet}</style>`);

			if (options.prepend) sheet.prependTo('head');
			else sheet.appendTo('head');

			stylesheets.set(stylesheetID, [ stylesheetComponentIdKey ]);
			debug(`adding stylesheet ${stylesheetID}`);

		} else {
			stylesheets.set(stylesheetID, currentStylesheetKeyList.push(stylesheetComponentIdKey));
		}
	}

	return {
		id: stylesheetID,
		componentIdKey: stylesheetComponentIdKey,
	};
}

function removeStyles(id, componentIdKey) {
	if (typeof window !== 'undefined') {
		const currentStylesheetKeyList = stylesheets.get(id);
		if (Array.isArray(currentStylesheetKeyList)) {
			const currentIndexOf = currentStylesheetKeyList.indexOf(componentIdKey);
			stylesheets.set(id, currentStylesheetKeyList.splice(currentIndexOf, 1));

			if (stylesheets.get(id).length < 1) {
				debug(`removing stylesheet ${id}`);
				$(`[data-cssorid=${id}]`).remove();
			}
		}
	}
}


export default function inject(template = () => {}, theme = {}, options = {}) {
	return function wrapWithCssor(WrappedComponent) {
		class StyleInjector extends Component {
			static displayName = `StyleInjector(${getDisplayName(WrappedComponent)})`

			static contextTypes = {
				theme: PropTypes.object,
			}

			componentWillMount() {
				const result = injectStyles(WrappedComponent, template, theme, this.context.theme || options.theme, options);
				this.stylesheetID = result.id;
				this.stylesheetComponentIdKey = result.componentIdKey;
			}

			shouldComponentUpdate(nextProps, nextState) {
				return shallowCompare(this, nextProps, nextState);
			}

			componentWillUnmount() {
				removeStyles(this.stylesheetID, this.stylesheetComponentIdKey);
			}

			render() {
				const { props } = this;
				return createElement(WrappedComponent, {
					...props,
				});
			}
		}

		StyleInjector.WrappedComponent = WrappedComponent;

		return hoistStatics(StyleInjector, WrappedComponent);
	};
}