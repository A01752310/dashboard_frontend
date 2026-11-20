"""In-process HTTP handler checks: no listening sockets or physical network required."""
import io
import importlib.util
import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.error import URLError

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('dashboard_server',ROOT/'server.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class HandlerTests(unittest.TestCase):
    def request(self,path,enabled=False,method='GET'):
        h=object.__new__(module.Handler)
        h.path=path
        h.server=SimpleNamespace(web_root=(ROOT/'dist').resolve(),enable_api=enabled,historian_url='http://127.0.0.1:9999')
        result={}
        h.send=lambda code,body,content_type='application/json': result.update(code=code,body=body,content_type=content_type)
        getattr(h,'do_'+method)()
        return result
    def test_build_static(self):
        self.assertEqual(self.request('/')['code'],200)
        self.assertIn(b'assets/',self.request('/')['body'])
    def test_paths_and_methods(self):
        for path in ['/../README.md','/%2e%2e/server.py','/assets/../../../server.py','/fixtures/','/server.py','/src/App.jsx']:
            self.assertEqual(self.request(path)['code'],404,path)
        for method in ['POST','PUT','DELETE','PATCH','HEAD','OPTIONS','CONNECT','TRACE']:
            self.assertEqual(self.request('/api/telemetry',method=method)['code'],405)
    def test_simulation_never_contacts_historian(self):
        with patch.object(module,'build_opener',side_effect=AssertionError('network forbidden')):
            self.assertEqual(self.request('/api/telemetry')['code'],503)
            self.assertEqual(self.request('/api/health')['code'],503)
    def test_proxy_allowlist(self):
        for path in ['/api/private','/api/telemetry?url=http://example.com','/api/telemetry?limit=999','/api/telemetry?run_id=a&run_id=b']:
            self.assertIn(self.request(path,True)['code'],[400,404])
    def test_proxy_fixed_origin_and_json(self):
        class Reply(io.BytesIO):
            status=200
            headers={'Content-Type':'application/json'}
        reply=Reply(b'[]')
        opener=SimpleNamespace(open=lambda req,timeout: self.verify_upstream(req,timeout,reply))
        with patch.object(module,'build_opener',return_value=opener):
            result=self.request('/api/telemetry?limit=50&run_id=INTEGRACION-001',True)
            self.assertEqual(result['body'],b'[]')
    def verify_upstream(self,req,timeout,reply):
        self.assertEqual(req.full_url,'http://127.0.0.1:9999/telemetry?limit=50&run_id=INTEGRACION-001')
        self.assertNotIn('Cookie',req.headers)
        self.assertNotIn('Authorization',req.headers)
        self.assertEqual(timeout,3)
        return reply
    def test_upstream_failure_maps_to_502(self):
        opener=SimpleNamespace(open=lambda *a,**kw: (_ for _ in ()).throw(URLError('offline')))
        with patch.object(module,'build_opener',return_value=opener):
            self.assertEqual(json.loads(self.request('/api/health',True)['body'])['error'],'historian_unreachable')
if __name__=='__main__':unittest.main()
