let addToastFn = null;

export function setToastHandler(fn) {
  addToastFn = fn;
}

export function toast(message, type = 'success', action = null) {
  if (addToastFn) addToastFn(message, type, action);
}
