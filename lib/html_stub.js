/* eslint-disable */

'use strict';

const htmlData = `
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Template Preview</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css" integrity="sha384-TX8t27EcRE3e/ihU7zmQxVncDAy5uIKz4rEkgIXeMed4M0jlfIDPvg6uqKI2xXr2" crossorigin="anonymous">
</head>

<body>
    <div id="editor"></div>
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js" integrity="sha384-DfXdz2htPH0lsSSs5nCTpuj/zy4C+OGpamoFVy38MVBnE+IbbVYUew+OrCXaRkfj" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-ho+j7jyWK8fNQe+A12Hb8AhRq26LrZ/JpcUGGOn+Y7RsweNrtN/tE3MoK7ZeZDyx" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/@json-editor/json-editor@2.5.1/dist/jsoneditor.min.js"></script>
    <script>
        const schema = {{schema_data}};
        const defaults = {{default_view}};
        const editor = new JSONEditor(document.getElementById('editor'), {
            schema,
            startval: defaults,
            compact: true,
            show_errors: 'always',
            disable_edit_json: true,
            disable_properties: true,
            disable_collapse: true,
            array_controls_top: true,
            theme: 'bootstrap4'
        });
    </script>
</body>
</html>
`;

module.exports = {
    htmlData
};
