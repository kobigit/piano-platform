<?php
header('Content-Type: application/json');

$dir          = "notes"; //path

$list = array(); //main array

if(is_dir($dir)){
    if($dh = opendir($dir)){
        while(($file = readdir($dh)) != false){

            if($file == "." or $file == ".."){
                //...
            } else { //create object with two fields
                
                array_push($list, $file);
            }
        }
    }

    echo json_encode($list);
}
?>