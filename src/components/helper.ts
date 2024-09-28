export const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  const debouncedFunc = (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
  debouncedFunc.cancel = () => clearTimeout(timeoutId);
  return debouncedFunc;
};

export const saveToStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error(e);
  }
};

export const loadFromStorage = (key: string): string => {
  try {
    const value = localStorage.getItem(key);
    if (value) return value;
    return "";
  } catch (e) {
    console.error(e);
    return "";
  }
};
