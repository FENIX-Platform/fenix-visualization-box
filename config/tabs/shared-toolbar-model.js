/*global define*/

define(function () {

    'use strict';

    return {

        format : {

            selector : {
                id : 'dropdown',
                source : [
                    { value : "localstring", label : "Local String"},
                    { value : "value", label : "Raw Value"}
                ],
                config : {
                    maxItems : 1
                },
                default : ['localstring']
            },

            template : {
                title : "Format"
            }
        },
  "decimal_digit": {

            "selector": {
                "id": "dropdown",
            
                "source": [

                    {"value": "0","label":0},
                    {"value": "1","label":1},
                    {"value": "2","label":2},
                    {"value": "3","label":3},
                    {"value": "4","label":4},
                    {"value": "5","label":5}
                ],
                "config" : {
                    maxItems : 1
                },
				default: [2]
            },

            "template" : {
                "title" : "decimals"
            },


            "className" : "testDec"

        },
        show : {

            selector : {
                id : "input",
                type : "checkbox",
                source : [
                    { value : "unit", label : "Unit"},
                    { value : "flag", label : "Flag"},
                    { value : "code", label : "Code"}
                ]
            },

            template : {
                title : "Show"
            }
        }

    }

});