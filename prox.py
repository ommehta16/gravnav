from flask import Flask, request, abort, make_response
import requests
import json
import time
import os

app = Flask(__name__)

last_save:float = 0

mem = {}

OVERPASS_API = "https://overpass-api.de/api/interpreter"

@app.route("/hello",methods=["POST","GET"])
def hello_check():
	return "hi"

def save_mem():
	try:
		with open("mem1.json",'w') as f: json.dump(mem,f)
		with open("mem.json",'w') as f:  json.dump(mem,f)

		return
	except: ...
	
	print("Could not save mem!")

	try:
		text = json.dumps(mem)
		with open("mem1.json",'w') as f: f.write(text)
		with open("mem.json",'w') as f:  f.write(text)

		return
	except:
		...
	print("Could not save... again. I'll just print it instead lollers")

	try:
		text = json.dumps(mem)
		print(text)
		
		return
	except:
		...
	print("If it's really THIS bad, I think there's no saving us...")
	print("I'm just going to print the straight object and hope it works for you")
	print(mem)
	

def load_mem():
	global mem

	if not os.path.isfile("mem.json"):
		with open("mem.json",'w') as f: f.write("{}")
		return
	with open("mem.json",'r') as f:
		mem = json.load(f)

load_mem()

@app.route("/",methods=["POST", "GET"])
def do_api():
	global last_save

	MINUTES = 60
	# print(request.data)

	if (request.method=="GET"): return "Hi! This is an api endpoint you should lowk not be here!"
	# print(request.data)
	reqText = request.data.decode()

	if reqText in mem:
		return mem[reqText]
	res = requests.request("POST",OVERPASS_API,data=request.data)
	
	if res.status_code != 200:
		abort(res.status_code)
		return
	if time.time() - last_save > 5*MINUTES:
		save_mem()

	last_save = time.time()
	jason = res.json()
	mem[reqText] = jason
	return jason

if __name__ == "__main__":
	try:
		app.run("127.0.0.1",3000)
	except:
		print("some error idk lol")
		save_mem()
		print("Saved successfully")
	finally:
		print("Saving...")
		save_mem()
		print("Saved successfully")

save_mem()