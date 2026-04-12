/**
 * jsPDF optionally loads `canvg` for SVG → canvas. We only use PNG `addImage` from html2canvas.
 * The real canvg package pulls core-js v2-style paths that break Vite builds; alias here instead.
 */
export default {
  fromString: () => ({
    render: async () => {
      /* no-op */
    },
  }),
};
