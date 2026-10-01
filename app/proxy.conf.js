// Proxy de desarrollo hacia FileMaker (Vite/http-proxy). Se elimina la cabecera Cookie
// porque en `localhost` las cookies se comparten entre TODOS los puertos/proyectos y, si
// se acumulan, provocan errores 431/400 o respuestas raras salvo en incógnito.
module.exports = {
  '/fmi': {
    target: 'https://fmsuit.cat',
    secure: true,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('cookie');
      });
    },
  },
};
