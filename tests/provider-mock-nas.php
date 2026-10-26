<?php
$code=(int)$argv[1];$socket=stream_socket_server('udp://127.0.0.1:37991',$errno,$error,STREAM_SERVER_BIND);
if(!$socket){fwrite(STDERR,$error);exit(1);}stream_set_timeout($socket,5);echo "READY\n";flush();
$request=stream_socket_recvfrom($socket,4096,0,$peer);
if($code&&strlen($request)>=20){$head=chr($code).$request[1].pack('n',20);$auth=md5($head.substr($request,4,16).'QA-Test-Secret',true);stream_socket_sendto($socket,$head.$auth,0,$peer);}
else if(!$code){usleep(2500000);}fclose($socket);
