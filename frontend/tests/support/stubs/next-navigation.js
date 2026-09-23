/** Route params for the dynamic pay and invoice routes. */
export const useParams = () => ({ id: 'inv_a11y_fixture' });
export const useRouter = () => ({
  back() {},
  push() {},
  replace() {},
  refresh() {},
});
export const usePathname = () => '/';
// `__PAY_PAGE_SEARCH__` lets tests simulate a wallet-handoff return URL.
export const useSearchParams = () => new URLSearchParams(globalThis.__PAY_PAGE_SEARCH__ || '');
