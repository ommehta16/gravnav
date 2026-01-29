# just relay via localhost to make dev easier :)

from flask import Flask, send_file

app = Flask(__name__)

@app.route("/<path:path>")
def idx(path):
	return send_file(path)

app.run()