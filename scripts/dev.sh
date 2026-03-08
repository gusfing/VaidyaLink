#!/bin/bash

# VaidyaLink Development Helper Script
# Manages local development environment with hot reload

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=========================================${NC}"
}

# Start all services
start_all() {
    print_header "Starting VaidyaLink Development Environment"

    print_info "Starting LocalStack..."
    docker-compose up -d localstack

    print_info "Waiting for LocalStack to be ready..."
    sleep 10

    print_info "Initializing LocalStack resources..."
    bash scripts/localstack-setup.sh wait

    print_info "Seeding database..."
    bash scripts/seed-database.sh

    print_info "Starting all services..."
    docker-compose up -d

    print_info ""
    print_header "Development Environment Ready!"
    print_info ""
    print_info "Services:"
    print_info "  Frontend:          http://localhost:3000"
    print_info "  LocalStack:        http://localhost:4566"
    print_info "  DynamoDB Admin:    http://localhost:8001"
    print_info "  Mailhog:           http://localhost:8025"
    print_info "  Redis:             localhost:6379"
    print_info ""
    print_info "Lambda Functions:"
    print_info "  Document Processing: http://localhost:9001"
    print_info "  Voice Processing:    http://localhost:9002"
    print_info "  Clinical Summarizer: http://localhost:9003"
    print_info "  FHIR Transformer:    http://localhost:9004"
    print_info "  ABDM Connector:      http://localhost:9005"
    print_info "  HITL Handler:        http://localhost:9006"
    print_info ""
    print_info "Hot reload is enabled for all services!"
    print_info "View logs with: docker-compose logs -f"
}

# Stop all services
stop_all() {
    print_header "Stopping VaidyaLink Development Environment"
    docker-compose down
    print_info "All services stopped"
}

# Restart all services
restart_all() {
    print_header "Restarting VaidyaLink Development Environment"
    docker-compose restart
    print_info "All services restarted"
}

# Restart specific service
restart_service() {
    local service=$1
    print_info "Restarting $service..."
    docker-compose restart "$service"
    print_info "$service restarted"
}

# View logs
view_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$service"
    fi
}

# Rebuild services
rebuild() {
    print_header "Rebuilding Services"
    docker-compose up -d --build
    print_info "Services rebuilt"
}

# Clean everything
clean() {
    print_warning "This will remove all containers, volumes, and data!"
    read -p "Are you sure? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cleaning up..."
        docker-compose down -v
        rm -rf localstack-data
        print_info "Cleanup complete"
    fi
}

# Show status
status() {
    print_header "Service Status"
    docker-compose ps
}

# Run tests
run_tests() {
    print_header "Running Tests"

    print_info "Running frontend tests..."
    cd frontend && npm test -- --run
    cd ..

    print_info "Running Python tests..."
    pytest backend/*/tests -v || true

    print_info "Tests complete"
}

# Show menu
show_menu() {
    echo ""
    echo "VaidyaLink Development Menu"
    echo "==========================="
    echo "1.  Start all services"
    echo "2.  Stop all services"
    echo "3.  Restart all services"
    echo "4.  Restart specific service"
    echo "5.  View logs (all)"
    echo "6.  View logs (specific service)"
    echo "7.  Rebuild services"
    echo "8.  Show status"
    echo "9.  Run tests"
    echo "10. Seed database"
    echo "11. Clean everything"
    echo "0.  Exit"
    echo ""
}

# Main execution
main() {
    if [ $# -eq 0 ]; then
        # Interactive mode
        while true; do
            show_menu
            read -p "Select option: " choice

            case $choice in
                1) start_all ;;
                2) stop_all ;;
                3) restart_all ;;
                4)
                    read -p "Enter service name: " service
                    restart_service "$service"
                    ;;
                5) view_logs ;;
                6)
                    read -p "Enter service name: " service
                    view_logs "$service"
                    ;;
                7) rebuild ;;
                8) status ;;
                9) run_tests ;;
                10) bash scripts/seed-database.sh ;;
                11) clean ;;
                0) exit 0 ;;
                *) print_warning "Invalid option" ;;
            esac
        done
    else
        # Command line mode
        case $1 in
            start) start_all ;;
            stop) stop_all ;;
            restart) restart_all ;;
            logs) view_logs "$2" ;;
            rebuild) rebuild ;;
            status) status ;;
            test) run_tests ;;
            seed) bash scripts/seed-database.sh ;;
            clean) clean ;;
            *)
                echo "Usage: $0 [start|stop|restart|logs|rebuild|status|test|seed|clean]"
                exit 1
                ;;
        esac
    fi
}

main "$@"
