#!/bin/bash
# Shell script to export all Mermaid DFD diagrams to PNG using mermaid-cli
# Requires: npm install -g @mermaid-js/mermaid-cli

echo "Exporting Data Flow Diagrams to PNG..."
echo

# Check if mermaid-cli is installed
if ! command -v mmdc &> /dev/null; then
    echo "Installing mermaid-cli..."
    npm install -g @mermaid-js/mermaid-cli
fi

echo "Exporting Context Diagram..."
mmdc -i dfd_context_diagram.mmd -o Context_Diagram.png -b white

echo "Exporting Superadmin DFD..."
mmdc -i dfd_superadmin.mmd -o DFD_Superadmin.png -b white

echo "Exporting User DFD..."
mmdc -i dfd_user.mmd -o DFD_User.png -b white

echo "Exporting Superadmin Users DFD..."
mmdc -i dfd_superadmin_users.mmd -o DFD_Superadmin_Users.png -b white

echo "Exporting Superadmin Schedules DFD..."
mmdc -i dfd_superadmin_schedules.mmd -o DFD_Superadmin_Schedules.png -b white

echo "Exporting Superadmin Approve DFD..."
mmdc -i dfd_superadmin_approve.mmd -o DFD_Superadmin_Approve.png -b white

echo
echo "All diagrams exported successfully!"
echo "Check the current directory for PNG files."

