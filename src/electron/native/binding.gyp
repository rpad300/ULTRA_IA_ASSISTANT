{
  "targets": [
    {
      "target_name": "wasapi_capture",
      "sources": [
        "wasapi-capture.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "-lole32.lib",
            "-loleaut32.lib"
          ]
        }]
      ]
    }
  ]
}




