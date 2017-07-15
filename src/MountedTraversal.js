import isEmpty from 'lodash/isEmpty';
import values from 'object.values';
import isSubset from 'is-subset';
import { findAllInRenderedTree, isCompositeComponent } from 'react-dom/test-utils';

import {
  internalInstance,
  nodeEqual,
  nodeMatches,
  propsOfNode,
  isFunctionalComponent,
  splitSelector,
  selectorType,
  isCompoundSelector,
  AND,
  SELECTOR,
  nodeHasType,
  nodeHasProperty,
} from './Utils';
import {
  isDOMComponent,
  isCompositeComponentWithType,
  isElement,
  findDOMNode,
} from './react-compat';
import { REACT013 } from './version';

export function getNode(inst) {
  return inst;
}

export function instEqual(a, b, lenComp) {
  return nodeEqual(getNode(a), getNode(b), lenComp);
}

export function instMatches(a, b, lenComp) {
  return nodeMatches(getNode(a), getNode(b), lenComp);
}

export function instHasClassName(inst, className) {
  const node = findDOMNode(inst);
  if (node === null) { // inst renders null
    return false;
  }
  if (node.classList) {
    return node.classList.contains(className);
  }
  let classes = node.className || '';
  if (typeof classes === 'object') {
    classes = classes.baseVal;
  }
  classes = classes.replace(/\s/g, ' ');
  return ` ${classes} `.indexOf(` ${className} `) > -1;
}

function hasClassName(inst, className) {
  if (!isDOMComponent(inst)) {
    return false;
  }
  return instHasClassName(inst, className);
}

export function instHasId(inst, id) {
  if (!isDOMComponent(inst)) return false;
  const instId = findDOMNode(inst).id || '';
  return instId === id;
}

function isFunctionalComponentWithType(inst, func) {
  return isFunctionalComponent(inst) && getNode(inst).type === func;
}

export function instHasType(inst, type) {
  switch (typeof type) {
    case 'string':
      return nodeHasType(getNode(inst), type);
    case 'function':
      return isCompositeComponentWithType(inst, type) ||
        isFunctionalComponentWithType(inst, type);
    default:
      return false;
  }
}

export function instHasProperty(inst, propKey, stringifiedPropValue) {
  const node = getNode(inst);

  if (!node) {
    return false;
  }

  return nodeHasProperty(node, propKey, stringifiedPropValue);
}

// called with private inst
export function renderedChildrenOfInst(inst) {
  return REACT013
    ? inst._renderedComponent._renderedChildren
    : inst._renderedChildren;
}

// called with a private instance
export function childrenOfInstInternal(inst) {
  throw new Error("I have no idea how to implement this on a Fiber stack!");
}

export function internalInstanceOrComponent(node) {
  if (REACT013) {
    return node;
  } else if (node._reactInternalComponent) {
    return node._reactInternalComponent;
  } else if (node._reactInternalInstance) {
    return node._reactInternalInstance;
  }
  return node;
}

export function childrenOfInst(node) {
  return childrenOfInstInternal(internalInstanceOrComponent(node));
}

// This function should be called with an "internal instance". Nevertheless, if it is
// called with a "public instance" instead, the function will call itself with the
// internal instance and return the proper result.
function findAllInRenderedTreeInternal(inst, test) {
  return findAllInRenderedTree(inst, test);
}

// This function could be called with a number of different things technically, so we need to
// pass the *right* thing to our internal helper.
export function treeFilter(node, test) {
  if (!node || !node._reactInternalInstance) {
    return [];
  }
  return findAllInRenderedTree(node, n => n && test(n));
}

function pathFilter(path, fn) {
  return path.filter(tree => treeFilter(tree, fn).length !== 0);
}

export function pathToNode(node, root) {
  const queue = [root];
  const path = [];

  const hasNode = testNode => node === testNode;

  while (queue.length) {
    const current = queue.pop();
    const children = childrenOfInst(current);

    if (current === node) return pathFilter(path, hasNode);

    path.push(current);

    if (children.length === 0) {
      // leaf node. if it isn't the node we are looking for, we pop.
      path.pop();
    }
    queue.push(...children);
  }

  return null;
}

export function parentsOfInst(inst, root) {
  return pathToNode(inst, root).reverse();
}

export function instMatchesObjectProps(inst, props) {
  if (!isDOMComponent(inst)) return false;
  const node = getNode(inst);
  return isSubset(propsOfNode(node), props);
}

export function buildInstPredicate(selector) {
  switch (typeof selector) {
    case 'function':
      // selector is a component constructor
      return inst => instHasType(inst, selector);

    case 'string':
      if (isCompoundSelector.test(selector)) {
        return AND(splitSelector(selector).map(buildInstPredicate));
      }

      switch (selectorType(selector)) {
        case SELECTOR.CLASS_TYPE:
          return inst => hasClassName(inst, selector.slice(1));
        case SELECTOR.ID_TYPE:
          return inst => instHasId(inst, selector.slice(1));
        case SELECTOR.PROP_TYPE: {
          const propKey = selector.split(/\[([a-zA-Z][a-zA-Z_\d\-:]*?)(=|])/)[1];
          const propValue = selector.split(/=(.*?)]/)[1];

          return node => instHasProperty(node, propKey, propValue);
        }
        default:
          // selector is a string. match to DOM tag or constructor displayName
          return inst => instHasType(inst, selector);
      }

    case 'object':
      if (!Array.isArray(selector) && selector !== null && !isEmpty(selector)) {
        return node => instMatchesObjectProps(node, selector);
      }
      throw new TypeError(
        'Enzyme::Selector does not support an array, null, or empty object as a selector',
      );

    default:
      throw new TypeError('Enzyme::Selector expects a string, object, or Component Constructor');
  }
}
