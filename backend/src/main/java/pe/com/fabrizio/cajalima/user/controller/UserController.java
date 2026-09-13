package pe.com.fabrizio.cajalima.user.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import pe.com.fabrizio.cajalima.user.dto.CreateUserRequest;
import pe.com.fabrizio.cajalima.user.dto.UserResponse;
import pe.com.fabrizio.cajalima.user.service.UserService;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService users;

    public UserController(UserService users) { this.users = users; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
        return users.createEmployee(request);
    }
}
