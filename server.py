import http.server
import socketserver

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler
# On ajoute explicitement le type MIME pour les extensions Chrome
Handler.extensions_map.update({
    '.crx': 'application/x-chrome-extension',
})

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serveur actif sur le port {PORT}")
    httpd.serve_forever()