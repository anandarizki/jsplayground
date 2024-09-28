export const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  const debouncedFunc = (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
  debouncedFunc.cancel = () => clearTimeout(timeoutId);
  return debouncedFunc;
};

const keyStorage = 'jsPlaygroundCode';
export const saveToStorage = (value: string) => {
  try {
    localStorage.setItem(keyStorage, value);
  } catch (e) {
    console.error(e);
  }
};

export const loadFromStorage = (): string => {
  const placeHolder = "//Write you JS code here\nconsole.log('Hello world!')"
  try {
    const value = localStorage.getItem(keyStorage);
    if (value) return value;
    return placeHolder;
  } catch (e) {
    console.error(e);
    return placeHolder;
  }
};
