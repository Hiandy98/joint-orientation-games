-- wrk_test.lua
wrk.method = "POST"
wrk.body   = '{"message":"hello","isFileRename":false}'
wrk.headers["Content-Type"] = "application/json"